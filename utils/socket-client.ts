import {
    ACTION,
} from './constants';
import {
    RoomInput, RoomParticipants, SocketData,
    SocketRoomData,
    SocketStreamIceData,
    SocketStreamSdpData,
} from './interfaces';
import * as io from 'socket.io-client';
export interface SocketClientSocket extends SocketIOClient.Socket{
    on(event: 'error', listener: (error) => void): this
    on(event: 'connect', listener: (data) => void): this
    on(event: ACTION.JOIN_ROOM, listener: (event:SocketRoomData) => void): this
    on(event: ACTION.LEAVE_ROOM, listener: (event:SocketRoomData) => void): this
    on(event: ACTION.STREAM_ENDED, listener: (event:SocketRoomData) => void): this
    on(event: ACTION.SDP, listener: (event:SocketStreamSdpData) => void): this
    on(event: ACTION.ICE, listener: (event:SocketStreamIceData) => void): this
}
type ApiRequest = (json:{})=>Promise<{}|void>
export class SocketClient implements Record<ACTION,ApiRequest>{
    readonly socket:SocketClientSocket;
    constructor(server:string){
        this.socket = io(server) as SocketClientSocket;
    }
    async joinRoom(json:RoomInput):Promise<void> {
        await this.emitPromise(ACTION.JOIN_ROOM, json)
    }
    async leaveRoom(json:RoomInput):Promise<void> {
        await this.emitPromise(ACTION.LEAVE_ROOM, json)
    }
    async roomParticipants(json:RoomInput):Promise<RoomParticipants> {
        return await this.emitPromise(ACTION.ROOM_PARTICIPANTS, json) as RoomParticipants
    }
    async ice(json:SocketStreamIceData):Promise<void> {
        await this.emitPromise(ACTION.ICE, json)
    }
    async sdp(json:SocketStreamSdpData):Promise<void> {
        await this.emitPromise(ACTION.SDP, json)
    }
    async streamEnded(json:SocketData):Promise<void> {
        await this.emitPromise(ACTION.STREAM_ENDED, json)
    }
    private emitPromise(action:ACTION,json:{}):Promise<{}|void>{
        return new Promise((resolve,reject)=>{
            this.socket.emit(action,json,(data)=>{
                if(!data || !data.hasOwnProperty('errorId')){
                    resolve(data)
                }
                else {
                    reject(data)
                }
            });
        })
    }
}