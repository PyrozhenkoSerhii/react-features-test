export interface IPeers {
  [socketId: string]: RTCPeerConnection;
}

export interface IDataChannelList {
  [socketId: string]: RTCDataChannel;
}
