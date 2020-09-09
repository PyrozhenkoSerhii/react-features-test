import * as React from "react";
import { useLocation } from "react-router-dom";
import { Button } from "antd";
import * as SocketIO from "socket.io-client";
// @types/recordrtc is broken, thus we use this lib without typing
import * as RecordRTCPromisesHandler from "recordrtc";

import { Wrapper } from "./styled";
import { peerConfig, createPeerConnection } from "./utils/peer";
import { IDataChannelList, IPeers } from "./utils/interfaces";
import { float32Concat } from "./utils/data";

import { ACTION } from "../utils/constants";
import { RoomInput, RoomParticipants, SocketStreamSdpData, SocketStreamIceData, SocketData } from "../utils/interfaces";

const { useEffect, useState } = React;
const { StereoAudioRecorder } = RecordRTCPromisesHandler;
const context = new AudioContext();

let audioQueue;
const output = context.createScriptProcessor(4096, 1, 1);
output.onaudioprocess = (e) => {
  if (audioQueue && audioQueue.length) {
    const samplesToPlay = audioQueue.subarray(0, 4096);
    audioQueue = audioQueue.subarray(4096, audioQueue.length);
    console.log(samplesToPlay);
    e.outputBuffer.getChannelData(0).set(samplesToPlay);
  } else {
    e.outputBuffer.getChannelData(0).set(new Float32Array(4096));
  }
};
output.connect(context.destination);

let read = 0;
const dataChannelList: IDataChannelList = {};

export const App = (): JSX.Element => {
  const { pathname } = useLocation();
  const [type, id] = pathname.split("/").filter(Boolean);

  const [stream, setStream] = useState<MediaStream>(null);
  const getAudioStream = async () => {
    setStream(await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    }));
  };

  useEffect(() => {
    if (type === "sender") {
      getAudioStream();
    }
  }, []);

  useEffect(() => {
    if (stream) {
      const recorder = new RecordRTCPromisesHandler(stream, {
        type: "audio/wav",
        recorderType: StereoAudioRecorder,
        timeSlice: 50,
        ondataavailable: () => {
          const internalRecorder = recorder.getInternalRecorder();
          const { leftchannel } = internalRecorder;

          const readItems: Array<Float32Array> = read ? leftchannel.slice(read) : leftchannel;
          const readItemsCount: number = Object.keys(readItems).length;
          read += readItemsCount;

          Object.values(dataChannelList).forEach((channel) => {
            readItems.forEach((item) => {
              if (channel.readyState === "open") {
                channel.send(item);
              }
            });
          });
        },
      });
      recorder.startRecording();
    }
  }, [stream]);

  useEffect(() => {
    if (type && id) {
      const socket = SocketIO("https://app.avcore.io:443");
      const roomInput: RoomInput = { roomId: id };

      console.log(`> Socket for ${type} with id ${id} created`);

      socket.on("connect", async () => {
        socket.emit(ACTION.JOIN_ROOM, roomInput);
        console.log(`> Socket for ${type} with id ${id} connected`);

        if (type === "sender") {
          const connections: IPeers = {};

          socket.emit(ACTION.ROOM_PARTICIPANTS, roomInput, ({ participants }: RoomParticipants) => {
            console.log("> Searching for room participants");
            participants.forEach(({ socketId }) => {
              if (connections[socketId] || socketId === socket.id) return;
              console.log(`Found ${socketId} in the room. Creating peer connection and datachannel`);

              const peerConnection = createPeerConnection(socket, socketId, dataChannelList);
              connections[socketId] = peerConnection;
            });
          });

          socket.on(ACTION.JOIN_ROOM, ({ socketId }: SocketData) => {
            console.log(`Socket ${socketId} joined the room. Creating peer connection and datachannel`);
            if (connections[socketId]) return;

            const peerConnection = createPeerConnection(socket, socketId, dataChannelList);
            connections[socketId] = peerConnection;
          });

          socket.on(ACTION.LEAVE_ROOM, ({ socketId }: SocketData) => {
            console.log(`Socket ${socketId} left the room, closing the connection and datachannel`);
            if (dataChannelList[socketId]) {
              dataChannelList[socketId].close();
              delete connections[socketId];
            }
            if (connections[socketId]) {
              connections[socketId].close();
              delete connections[socketId];
            }
          });

          socket.on(ACTION.SDP, ({ sdp, socketId }: SocketStreamSdpData) => {
            console.log(`> [Sender] sdp action: for socket: ${socketId}: `, sdp);

            if (sdp.type === "answer") {
              connections[socketId].setRemoteDescription(sdp);
            }
          });

          socket.on(ACTION.ICE, async ({ socketId, ice }: SocketStreamIceData) => {
            console.log(`> [Sender] ice action: for socket: ${socketId}: `, ice);

            if (!connections[socketId]) {
              console.log(`> [Sender] There is no connection to set ice to (socket: ${socketId})`);
              return;
            }
            connections[socketId].addIceCandidate(new RTCIceCandidate(ice));
          });
        } else if (type === "receiver") {
          let connection: RTCPeerConnection = null;

          socket.on(ACTION.SDP, (data: SocketStreamSdpData) => {
            console.log(`> [Reciever] sdp action: for socket: ${data.socketId}: `, data.sdp);

            if (data.sdp.type !== "offer") return;

            const peerConnection = new RTCPeerConnection(peerConfig);
            peerConnection
              .setRemoteDescription(data.sdp)
              .then(() => peerConnection.createAnswer())
              .then((sdp) => peerConnection.setLocalDescription(sdp))
              .then(() => {
                const sdpData: SocketStreamSdpData = {
                  sdp: peerConnection.localDescription,
                  socketId: data.socketId,
                };
                socket.emit(ACTION.SDP, sdpData);
              });

            peerConnection.ondatachannel = (event) => {
              console.log("> [Receiver] peer's ondatachannel:", event);

              const receiveChannel = event.channel;
              receiveChannel.binaryType = "arraybuffer";
              receiveChannel.onmessage = (event) => {
                const buffer = new Float32Array(event.data);

                if (audioQueue) {
                  audioQueue = float32Concat(audioQueue, buffer);
                } else {
                  audioQueue = buffer;
                }
              };

              receiveChannel.onopen = () => {
                console.log("Data channel has been opened");
              };
              receiveChannel.onclose = () => {
                console.log("Data channel has been closed");
              };
            };

            peerConnection.onicecandidate = ({ candidate }) => {
              console.log("> [Receiver] peer's onicecandidate:", candidate);

              if (candidate) {
                const iceData: SocketStreamIceData = {
                  ice: candidate,
                  socketId: data.socketId,
                };
                socket.emit(ACTION.ICE, iceData);
              }
            };

            connection = peerConnection;
          });

          socket.on(ACTION.ICE, async ({ ice }: SocketStreamIceData) => {
            console.log("> [Receiver] ice action:", ice);

            if (connection) {
              connection.addIceCandidate(new RTCIceCandidate(ice))
                .catch((err) => console.error(err));
            }
          });
        }
      });
    }
  }, [type, id]);

  const [playbackActive, setPlaybackActive] = useState(false);
  const togglePlayback = () => {
    if (playbackActive) {
      context.suspend();
    } else {
      context.resume();
    }
    setPlaybackActive((prevValue) => !prevValue);
  };

  return (
    <Wrapper>
      {type === "receiver" && (
        <Button onClick={togglePlayback}>
          {playbackActive ? "Stop playback" : "Start playback"}
        </Button>
      )}
    </Wrapper>
  );
};
