const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const e = require("express");

app.use(cors());
app.get("/", (req, res) => {
  res.send("I am the Mafia Server");
});
const server = http.createServer(app);


const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const rooms = {};
const mafia={};
const gameState={};


io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  socket.on("join_room", (data) => {



    const { room, playerName } = data;


    var isHost = false;	
    // Create the room if it doesn't exist
    if (!rooms[room]) {
      rooms[room] = [];
      io.to(socket.id).emit("room_created", room);
      isHost = true;
    }
    if(gameState[room]==="started"){
      console.log("Game is in progress");
      socket.emit("game_inprogress");
    }
    // Add the player to the room
   else{
    
     rooms[room].push({ id: socket.id, name: playerName, isDead: false, isHost: isHost,votes:0 });
     console.log(rooms[room]);
    // Notify other clients about the updated player list
    io.to(room).emit("update_players", rooms[room]);


    //check if game is started
   
    // Join the room
    socket.join(room);

    // Broadcast a message to the room when a player joins
    io.to(room).emit("receive_message", {
      playerName: "System",
      message: `${playerName} has joined the room.`,
    });

    io.to(room).emit("update_players", rooms[room]);


  }
 

  });





  socket.on("send_message", (data) => {
    console.log(data);
    socket.to(data.room).emit("receive_message", data);
  });

  socket.on("start_game", (room) => {

    console.log("Game Started");

    //set game state to started
    gameState[room]="started";
    
    
    //check if mafis exists for the room
    if(mafia[room]==null){
      const randomPlayerIndex = Math.floor(Math.random() * rooms[room].length);
      const mafiaId = rooms[room][randomPlayerIndex].id;
      mafia[room] = mafiaId;
      io.to(mafiaId).emit("make_mafia");
    }

    io.to(room).emit("game_started", rooms[room]);



  });

  socket.on("kill_player", (data) => {

  
    console.log(data);

    const { room, playerId } = data;

  

    // Mark the player as dead

    const targetPlayerIndex=rooms[room].findIndex(player=>player.id===data.playerid);


    
    if (targetPlayerIndex !== -1) {
      // Mark the player as dead
      rooms[room][targetPlayerIndex].isDead=true;

      socket.to(room).emit("update_players", rooms[room]);

      socket.to(room).emit("player_killed", rooms[room][targetPlayerIndex]);
     

    }

    else{
      console.log(`Player with ID ${playerId} not found in room ${room}`);
    }

    });

  socket.on("vote_player", (data) => {

    const { room, playerId } = data;

    //update votes

    const targetPlayerIndex=rooms[room].findIndex(player=>player.id===data.playerid);

    //console.log(targetPlayerIndex);

    if (targetPlayerIndex !== -1) {
      // update votes
      rooms[room][targetPlayerIndex].votes++;

      socket.to(room).emit("update_players", rooms[room]);
      socket.emit("update_players", rooms[room]);

      //player1 voted player2
      socket.to(room).emit("receive_message",{playerName:"System",message:`${data.playerName} voted ${rooms[room][targetPlayerIndex].name} as Killer`});
      socket.emit("receive_message",{playerName:"System",message:`You voted ${rooms[room][targetPlayerIndex].name} as Killer`});


    }
    else{
      console.log(`Player with ID ${playerId} not found in room ${room}`);
    }


    var alivePlayers=rooms[room].filter(player=>player.isDead===false);

    //calculate the total votes for all alive players
   var totalVotesReceived= rooms[room].reduce((total,player)=>total+player.votes,0);


    if(totalVotesReceived===alivePlayers.length){
      //find the player with maximum votes
      var maxVotes=0;
      var suspectPlayerIndex=0;
      for(var i=0;i<rooms[room].length;i++){
        if(rooms[room][i].votes>maxVotes){
          maxVotes=rooms[room][i].votes;
          suspectPlayerIndex=i;
        }
      }

      //check if the player is mafia
      if(rooms[room][suspectPlayerIndex].id===mafia[room]){
        //mafia is caught

        //reset votes
        rooms[room]=rooms[room].map(player=>{player.votes=0;return player;});

        //reset mafia
        mafia[room]=null;

        //reset dead players
        rooms[room]=rooms[room].map(player=>{player.isDead=false;return player;});

        //update players
        socket.to(room).emit("update_players", rooms[room]);
        socket.emit("update_players", rooms[room]);

        socket.to(room).emit("mafia_catched", rooms[room][suspectPlayerIndex]);
        socket.emit("mafia_catched", rooms[room][suspectPlayerIndex]);
      }
      else{
        //mafia is not caught

        //kill the player with maximum votes
        rooms[room][suspectPlayerIndex].isDead=true;

        //reset votes
        rooms[room]=rooms[room].map(player=>{player.votes=0;return player;});

        //update players
        socket.to(room).emit("update_players", rooms[room]);
        socket.emit("update_players", rooms[room]);
        socket.to(room).emit("mafia_not_catched", rooms[room][suspectPlayerIndex]);
        socket.emit("mafia_not_catched", rooms[room][suspectPlayerIndex]);
      }
     

      }

    
        });  


  socket.on("reset_game", (room) => {

    

    //reset mafia
    mafia[room]=null;
    console.log("Game Reset");
    console.log(rooms);
    console.log(room);
    console.log(rooms[room]);
    

    //reset dead players
    rooms[room]=rooms[room].map(player=>{player.isDead=false;return player;});

    //reset votes
    rooms[room]=rooms[room].map(player=>{player.votes=0;return player;});

    mafia[room]=null;

    //update players
    socket.to(room).emit("update_players", rooms[room]);
    socket.emit("update_players", rooms[room]);

    socket.to(room).emit("game_restarted", rooms[room]);
    socket.emit("game_restarted", rooms[room]);
   
  });


  socket.on("kick_player", (data) => {

    const { room, playerId } = data;

    // delete the player from the room
    rooms[room] = rooms[room].filter((player) => player.id !== data.playerid);

    io.sockets.sockets.get(data.playerid).disconnect(true);

    //disconnect the player from the room
  

 

    // Notify the other client in the room
    socket.to(room).emit("update_players", rooms[room]);


      socket.to(room).emit("update_players", rooms[room]);

      socket.emit("update_players", rooms[room]);

     
     

    }
      
     
  
      );




      
  
    
   

  socket.on("disconnect", () => {


    
    // Remove the player from all rooms when they disconnect
    for (const room in rooms) {
      rooms[room] = rooms[room].filter((player) => player.id !== socket.id);
      io.to(room).emit("update_players", rooms[room]);
    }

    console.log(`User Disconnected: ${socket.id}`);
  });
});

server.listen(3002, () => {
  console.log("SERVER IS RUNNING");
});
