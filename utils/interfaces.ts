import { ERROR } from "./constants";

export interface ErrorData {
    errorId: ERROR
    error?: any
}
export interface RoomInput {
    roomId:string
}
export interface RoomParticipants {
    participants:SocketData[]
}
export interface SocketData {
    socketId:string
}
export type SocketRoomData = RoomInput & SocketData
export interface SocketStreamSdpData extends SocketData{
    sdp
}
export interface SocketStreamIceData extends SocketData{
    ice
}
