import * as React from "react";
import { useLocation } from "react-router-dom";
import * as SocketIO from "socket.io-client";
// @types/recordrtc is broken, thus we use this lib without typing
import * as RecordRTCPromisesHandler from "recordrtc";

import { Wrapper } from "./styled";
import { getFileName, saveByteArray } from "./utils/download";
import { peerConfig, createPeerConnection } from "./utils/peer";
import { IDataChannelList, IPeers } from "./utils/interfaces";
import { ACTION } from "../utils/constants";
import { RoomInput, RoomParticipants, SocketStreamSdpData, SocketStreamIceData, SocketData } from "../utils/interfaces";

const { useEffect, useState, useRef } = React;
const { StereoAudioRecorder } = RecordRTCPromisesHandler;

/**
 * Global variables for convenience
 */
let read = 0;
const dataChannelList: IDataChannelList = {};

export const App = (): JSX.Element => {
  const { pathname } = useLocation();
  const [type, id] = pathname.split("/").filter(Boolean);

  const [stream, setStream] = useState<MediaStream>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

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
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (type && id) {
      const socket = SocketIO("https://app.avcore.io:443");
      const roomInput: RoomInput = { roomId: id };

      socket.on("connect", async () => {
        socket.emit(ACTION.JOIN_ROOM, roomInput);

        if (type === "sender") {
          const connections: IPeers = {};

          socket.emit(ACTION.ROOM_PARTICIPANTS, roomInput, ({ participants }: RoomParticipants) => {
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
            if (sdp.type === "answer") {
              connections[socketId].setRemoteDescription(sdp);
            }
          });

          socket.on(ACTION.ICE, async ({ socketId, ice }: SocketStreamIceData) => {
            connections[socketId].addIceCandidate(new RTCIceCandidate(ice));
          });
        } else if (type === "receiver") {
          let connection: RTCPeerConnection = null;

          socket.on(ACTION.SDP, (data: SocketStreamSdpData) => {
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
              const receiveChannel = event.channel;
              receiveChannel.binaryType = "arraybuffer";

              let acceptedData = [];
              let fileNumber = 0;
              receiveChannel.onmessage = (event) => {
                acceptedData.push(new Float32Array(event.data));
                if (acceptedData.length === 100) {
                  console.log(acceptedData);
                  saveByteArray(acceptedData, getFileName(++fileNumber));
                  acceptedData = [];
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
            if (connection) {
              connection.addIceCandidate(new RTCIceCandidate(ice))
                .catch((err) => console.error(err));
            }
          });
        }
      });
    }
  }, [type, id]);

  return (
    <Wrapper>
      <audio ref={audioRef} controls autoPlay playsInline muted />
    </Wrapper>
  );
};
