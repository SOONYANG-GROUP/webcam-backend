const express = require("express");
const app = express();
const cors = require("cors");
app.use(cors());

const httpServer = require("http").createServer(app);
const io = require("socket.io")(httpServer, {
    cors: {
        origin: "*"
    }
});

// 현재 ws 접속 중인 유저들
let users = {};
// socket과 Room 일대일 관계 나타내는 Object
let socketToRoom = {};
// Maximum Values
const maximum = process.env.MAXNIMUM || 10;

io.on("connection", socket => {
    // Peer A가 받는 Socke
    socket.on("join_room", data => {
        // ws 접속 중인 user가 있는 경우
        if(users[data.room])
        {
            const length = users[data.room].length;
            if(length === maximum)
            {
                // 최대 값을 넘긴 경우
                // Full방이라는 것을 알려주기
                socket.to(socket.id).emit("room_full");
                return;
            }
            // 들어가려는 방에 socket을 넣어주기
            users[data.room].push({ id: socket.id });
        }
        else
        {
            users[data.room] = [{id: socket.id}];
        }
        // 유저가 전혀 없는 경우
        // 새로 users를 초기화
        // 일대일 관계 추가
        socketToRoom[socket.id] = data.room;
        // 현재 유저(Socket) join 시키기
        socket.join(data.room);
        console.log(`[${socketToRoom[socket.id]}]: ${socket.id} Enter`);
        
        // Room에 있는 user들 가져오기
        const usersInThisRoom = users[data.room].filter(
            user => user.id !== socket.id
        );
        console.log(usersInThisRoom);
        // welcome과 비슷한 역할을 수행합니다.
        io.sockets.to(socket.id).emit("all_users", usersInThisRoom);

    });

    // sender가 offer를 받아야하는 receiver에게 sender의 socket id, spd를 보낸다        
    // offerReceiveId: offer를 보내는 user의 socket id
    // offerSendId: offer를 받는 user의 socket id
    socket.on("offer", data => {
        // receiver(offer를 받는 주체)가 offer의 정보를 받는다.
        socket.to(data.offerReceiveID).emit("getOffer", {
            sdp: data.sdp,
            offerSendID: data.offerSendID,
        })
    });

    // offer를 보낸 상대에게 자신의 sdp와 socket id를 보낸다.
    // answerSendID: answer를 보내는 user의 socket id
    // answerReceiveID: answer를 받는 user의 socket id
    socket.on("answer", data => {
        // offer를 보낸 상대(answer를 받는 주체)가 자신의 정보를 받는다.
        socket.to(data.answerReceiveID).emit("getAnswer", {
            sdp: data.sdp,
            answerSendID: data.answerSendID
        })
    });

    // candidateSendID: candidate를 보내는 user의 socket id
    // candidate: sender의 RTCIceCandidate
    // candidateReceiveID: candidate를 받는 user의 socket id
    socket.on("candidate", data => {
        socket.to(data.candidateReceiveID).emit("getCandidate", {
            candidate: data.candidate,
            candidateSendID: data.candidateSendID
        })
    });

    socket.on("disconnect", () => {
        console.log(`[${socketToRoom[socket.id]}]: ${socket.id} exit`);
        const roomID = socketToRoom[socket.id];
        let room = users[roomID];
        if(room)
        {
            room = room.filter(user => user.id !== socket.id);
            users[roomID] = room;
            if(room.length === 0)
            {
                delete users[roomID];
                return;
            }
        }
        socket.to(roomID).emit("user_exit", { id: socket.id });
    });

    socket.on("send_message", (data) => {
        console.log(data);
        socket.to(data.room).emit("received_message", data);
    })
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    console.log(`[+] Server is running on ${PORT}`);
})