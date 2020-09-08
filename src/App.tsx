import * as React from "react";
import { useLocation } from "react-router-dom";
import * as SocketIO from "socket.io-client";
// @types/recordrtc is broken, thus we use this lib without typing
import * as RecordRTCPromisesHandler from "recordrtc";

import { Wrapper } from "./styled";
import { getFileName, saveByteArray } from "./utils";

import { ACTION } from "../utils/constants";
import { RoomInput, RoomParticipants, SocketStreamSdpData, SocketStreamIceData } from "../utils/interfaces";

const { useEffect, useState, useRef } = React;
const { StereoAudioRecorder } = RecordRTCPromisesHandler;

let counter = 0;
let read = 0;

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
    if (stream) {
      const recorder = new RecordRTCPromisesHandler(stream, {
        type: "audio/wav",
        recorderType: StereoAudioRecorder,
        timeSlice: 5000,
        ondataavailable: () => {
          const internalRecorder = recorder.getInternalRecorder();
          const { leftchannel } = internalRecorder;

          const readItems = read ? leftchannel.slice(read) : leftchannel;

          const readItemsCount = Object.keys(readItems).length;
          read += readItemsCount;

          saveByteArray(readItems, getFileName(++counter));
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
      const connections = [];

      socket.on("connect", async () => {
        socket.emit(ACTION.JOIN_ROOM, roomInput);

        if (type === "sender") {
          socket.emit(ACTION.ROOM_PARTICIPANTS, roomInput, (data: RoomParticipants) => {
            data.participants.forEach((participant) => {
              const peerConnection = new RTCPeerConnection();

              connections[participant.socketId] = peerConnection;

              peerConnection.onicecandidate = (event) => {
                console.log("sender's peer connection on icecandidate:", event);
                if (event.candidate) {
                  const iceData: SocketStreamIceData = {
                    ice: event.candidate,
                    socketId: participant.socketId,
                  };
                  socket.emit(ACTION.ICE, iceData);
                }
              };

              peerConnection
                .createOffer()
                .then((sdp) => peerConnection.setLocalDescription(sdp))
                .then(() => {
                  const sdpData: SocketStreamSdpData = {
                    sdp: peerConnection.localDescription,
                    socketId: participant.socketId,
                  };
                  socket.emit(ACTION.SDP, sdpData);
                });
            });
          });

          socket.on(ACTION.JOIN_ROOM, (data) => {
            console.log("join", data);
          });

          socket.on(ACTION.LEAVE_ROOM, (data) => {
            console.log("leave", data);
          });

          socket.on(ACTION.SDP, (data: SocketStreamSdpData) => {
            if (data.sdp.type === "answer") {
              console.log("sender on sdp answer: ", data);
              connections[data.socketId].setRemoteDescription(data.sdp);
            }
          });
          socket.on(ACTION.ICE, (data: SocketStreamIceData) => {
            console.log("sender on ice:", data);
            connections[data.socketId].addIceCandidate(new RTCIceCandidate(data.ice));
          });
        } else if (type === "receiver") {
          socket.on(ACTION.SDP, (data: SocketStreamSdpData) => {
            console.log("receiver on sdp offer:", data);
            const peerConnection = new RTCPeerConnection();
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

            peerConnection.onicecandidate = (event) => {
              console.log("receiver's peer connection on icecandidate:", event);
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
  }, [type, id]);

  return (
    <Wrapper>
      <audio ref={audioRef} controls autoPlay playsInline muted />
    </Wrapper>
  );
};
