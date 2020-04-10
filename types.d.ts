export type SelfJoinedRoomPayload = {
    room: string
}

export type MemberJoinedRoomPayload = {
    id: string,
    name: string
}

export type RoomMessagePayload = {
    room: string,
    subject: string,
    payload: any
}

export type SendToMembersPayload = {
    memberIds: string[],
    subject: string,
    payload: any
}

export type SendToRoomPayload = {
    room: string[],
    subject: string,
    payload: any
}

export type CommandJoinRoomPayload = {
    room: string,
    name: string
}
