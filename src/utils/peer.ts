import { IDataChannelList } from "./interfaces";
import { ACTION } from "../../utils/constants";
import { SocketStreamSdpData, SocketStreamIceData } from "../../utils/interfaces";

export const peerConfig = {
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

export const createDataChannel = (
  targetConnection: RTCPeerConnection,
  socketId: string,
  dataChannelList: IDataChannelList,
): void => {
  const sendChannel = targetConnection.createDataChannel("arraybufferchannel");
  sendChannel.onopen = () => {
    console.log(`Data channel with ${socketId} has been opened`);
    dataChannelList[socketId] = sendChannel;
  };
  sendChannel.onclose = () => {
    console.log(`Data channel with ${socketId} has been closed. Removing the datachannel from available list`);
    delete dataChannelList[socketId];
  };
};

export const createPeerConnection = (
  socket: SocketIOClient.Socket,
  socketId: string,
  dataChannelList: IDataChannelList,
): RTCPeerConnection => {
  const peerConnection = new RTCPeerConnection(peerConfig);

  createDataChannel(peerConnection, socketId, dataChannelList);

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

  return peerConnection;
};
