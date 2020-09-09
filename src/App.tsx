/* eslint-disable prefer-destructuring */
import * as React from "react";
import { useLocation } from "react-router-dom";
import * as SocketIO from "socket.io-client";
// @types/recordrtc is broken, thus we use this lib without typing
import * as RecordRTCPromisesHandler from "recordrtc";

import { Wrapper } from "./styled";
import { getFileName, saveByteArray } from "./utils";

import { ACTION } from "../utils/constants";
import { RoomInput, RoomParticipants, SocketStreamSdpData, SocketStreamIceData, SocketData } from "../utils/interfaces";

const { useEffect, useState, useRef } = React;
const { StereoAudioRecorder } = RecordRTCPromisesHandler;
let read = 0;
interface IDataChannelList {
  [id: string]: RTCDataChannel;
}
const dataChannelList: IDataChannelList = {};

const config = {
  sdpSemantics: "unified-plan",
  iceServers: [
    {
      urls: ["turn:18.196.113.204:3478"],
      username: "testUser",
      credential: "testPassword",
    },
    {
      urls: ["stun:18.196.113.204:3478"],
      username: "testUser",
      credential: "testPassword",
    },
  ],
  iceCandidatePoolSize: 2,
};

interface Peers {
  [id: string]: RTCPeerConnection;
}

export const App = (): JSX.Element => {
  const [stream, setStream] = useState<MediaStream>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { pathname } = useLocation();

  const [type, id] = pathname.split("/").filter(Boolean);

  const getAudioStream = async () => {
    setStream(await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    }));
  };

  useEffect(() => {
    getAudioStream();
  }, []);

  useEffect(() => {
    if (stream && type === "sender") {
      const recorder = new RecordRTCPromisesHandler(stream, {
        type: "audio/wav",
        recorderType: StereoAudioRecorder,
        timeSlice: 50,
        ondataavailable: () => {
          const internalRecorder = recorder.getInternalRecorder();
          const { leftchannel } = internalRecorder;

          const readItems = read ? leftchannel.slice(read) : leftchannel;
          const readItemsCount = Object.keys(readItems).length;
          read += readItemsCount;

          dataChannelList.forEach((channel) => {
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
    if (stream && type && id && !dataChannelList.length) {
      const socket = SocketIO("https://app.avcore.io:443");
      const roomInput: RoomInput = { roomId: id };
      const connections: Peers = {};

      socket.on("connect", async () => {
        socket.emit(ACTION.JOIN_ROOM, roomInput);

        if (type === "sender") {
          socket.emit(ACTION.ROOM_PARTICIPANTS, roomInput, (data: RoomParticipants) => {
            // data.participants.forEach((participant) => {
            //   if (connections[participant.socketId]) {
            //     console.log("connection is already created");
            //     return;
            //   }

            //   const peerConnection = new RTCPeerConnection(config);
            //   const sendChannel = peerConnection.createDataChannel("sendChannel");
            //   sendChannel.binaryType = "arraybuffer";
            //   sendChannel.onopen = () => {
            //     console.log(sendChannel.readyState);
            //     dataChannelList.push(sendChannel);
            //   };
            //   sendChannel.onclose = () => { console.log("closed"); };
            //   connections[participant.socketId] = peerConnection;

            //   peerConnection.onicecandidate = (event) => {
            //     console.log("sender's peer connection on icecandidate:", event);
            //     if (event.candidate) {
            //       const iceData: SocketStreamIceData = {
            //         ice: event.candidate,
            //         socketId: participant.socketId,
            //       };
            //       socket.emit(ACTION.ICE, iceData);
            //     }
            //   };

            //   peerConnection
            //     .createOffer()
            //     .then((sdp) => peerConnection.setLocalDescription(sdp))
            //     .then(() => {
            //       const sdpData: SocketStreamSdpData = {
            //         sdp: peerConnection.localDescription,
            //         socketId: participant.socketId,
            //       };
            //       socket.emit(ACTION.SDP, sdpData);
            //     });
            // });
          });

          socket.on(ACTION.JOIN_ROOM, ({ socketId }: SocketData) => {
            if (connections[socketId]) return;

            const peerConnection = new RTCPeerConnection(config);
            const sendChannel = peerConnection.createDataChannel("arraybufferchannel");
            sendChannel.onopen = () => {
              console.log(`Data channel with ${socketId} has been opened`);
              dataChannelList[socketId] = sendChannel;
            };
            sendChannel.onclose = () => {
              console.log(`Data channel with ${socketId} has been closed. Removing the datachannel from available list`);
              delete dataChannelList[socketId];
            };

            peerConnection.onicecandidate = (event) => {
              if (event.candidate) {
                const iceData: SocketStreamIceData = { ice: event.candidate, socketId };
                socket.emit(ACTION.ICE, iceData);
              }
            };

            peerConnection
              .createOffer()
              .then((sdp) => peerConnection.setLocalDescription(sdp))
              .then(() => {
                const sdpData: SocketStreamSdpData = {
                  sdp: peerConnection.localDescription,
                  socketId,
                };
                socket.emit(ACTION.SDP, sdpData);
              });

            connections[socketId] = peerConnection;
          });

          socket.on(ACTION.LEAVE_ROOM, (data) => {
            console.log("leave", data);
          });

          socket.on(ACTION.SDP, (data: SocketStreamSdpData) => {
            if (data.sdp.type === "answer") {
              console.log("sender on sdp answer: ", data);
              connections[data.socketId].setRemoteDescription(data.sdp);
              console.log(connections[data.socketId].iceConnectionState);
            }
          });
          socket.on(ACTION.ICE, async (data: SocketStreamIceData) => {
            const connection = connections[data.socketId];
            console.log(connection.iceConnectionState);
            connection.addIceCandidate(new RTCIceCandidate(data.ice));
          });
        } else if (type === "receiver") {
          socket.on(ACTION.SDP, (data: SocketStreamSdpData) => {
            console.log("receiver on sdp offer:", data);
            const peerConnection = new RTCPeerConnection(config);
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
              receiveChannel.onopen = () => { console.log("on open"); };
              receiveChannel.onclose = () => { console.log("on close"); };
            };

            peerConnection.onicecandidate = (event) => {
              console.log(peerConnection.iceConnectionState);

              if (event.candidate) {
                const iceData: SocketStreamIceData = {
                  ice: event.candidate,
                  socketId: id,
                };
                socket.emit(ACTION.ICE, iceData);
              }
            };
          });
        }
      });
    }
  }, [stream, type, id]);

  return (
    <Wrapper>
      <audio ref={audioRef} controls autoPlay playsInline muted />
    </Wrapper>
  );
};
