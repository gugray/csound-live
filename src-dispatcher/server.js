const port = 9300;

import { WebSocketServer } from "ws";
import express from "express";
import * as http from "http";

const app = express();
const server = http.createServer(app);
const players = [];
let synthSocket = null;

const wsPlayerServer = new WebSocketServer({ noServer: true });
const wsSynthServer = new WebSocketServer({ noServer: true });

class Player {
  constructor(ws) {
    this.ws = ws;
    this.joinRequested = null;
    this.noteId = -1;
  }
}

wsPlayerServer.on("connection", (ws) => {
  console.log("Player connected");
  players.push(new Player(ws));

  ws.on("close", () => {
    console.log("Player disconnected");
    const ix = players.findIndex(p => p.ws == ws);
    let freedNoteId = -1;
    if (ix > -1) {
      freedNoteId = players[ix].noteId
      players.splice(ix, 1);
    }

    // Admit longest waiting player, if leaving player held a note
    if (freedNoteId == -1) return;
    occupyNote(freedNoteId);
  });

  ws.on("message", (msg) => {

    console.log(`Message from player: ${msg}`);
    const ix = players.findIndex(p => p.ws == ws);
    if (ix == -1) return;
    const player = players[ix];

    // Wants to join
    if (msg == "JOIN") {
      const noteId = getFreeNoteId();
      if (noteId == -1) {
        if (!player.joinRequested)
          player.joinRequested = new Date();
      }
      else {
        player.joinRequested = null;
        player.noteId = noteId;
        player.ws.send(`NOTEID ${noteId}`);
      }
      return;
    }

    // Leaves
    if (msg == "LEAVE") {
      if (player.noteId != -1)
        occupyNote(player.noteId);
      player.noteId = -1;
      player.joinRequested = null;
      return;
    }

    // This is a message for the synth
    if (!synthSocket) return;
    if (player.noteId == -1) return;
    const synthMsg = `NOTE ${player.noteId} ${msg}`;
    synthSocket.send(synthMsg);
  });
});

function getFreeNoteId() {
  const noteIds = [0, 1, 2, 3, 4, 5, 6, 7];
  for (const p of players) {
    if (p.noteId == -1) continue;
    const ix = noteIds.indexOf(p.noteId);
    noteIds.splice(ix, 1);
  }
  if (noteIds.length == 0) return -1;
  return noteIds[0];
}

function occupyNote(noteId) {
  let waiting = null;
  for (const p of players) {
    if (!p.joinRequested) continue;
    if (waiting == null || p.joinRequested < waiting.joinRequested)
      waiting = p;
  }
  if (!waiting) return;
  waiting.noteId = noteId;
  waiting.joinRequested = null;
  waiting.ws.send(`NOTEID ${waiting.noteId}`);
}

wsSynthServer.on("connection", (ws) => {
  console.log("Synth connected");
  if (synthSocket) {
    console.log("There is already a synth connection; closing it.");
    synthSocket.close();
  }
  synthSocket = ws;

  ws.on("close", () => {
    console.log("Synth disconnected");
    synthSocket = null;
  });

  ws.on("message", (msg) => {
    console.log(`Message from synth: ${msg}`);
    for (const p of players) {
      p.ws.send(`${msg}`);
    }
  });
});

// Attach WebSocket servers specific paths
server.on("upgrade", (request, socket, head) => {
  if (request.url === '/player') {
    wsPlayerServer.handleUpgrade(request, socket, head, (ws) => {
      wsPlayerServer.emit("connection", ws, request);
    });
  }
  else if (request.url === '/synth') {
    wsSynthServer.handleUpgrade(request, socket, head, (ws) => {
      wsSynthServer.emit("connection", ws, request);
    });
  }
  else {
    socket.destroy(); // Close the connection for other paths
  }
});

// Serve static files from the "/public" subfolder for all other paths
app.use(express.static("public"));

// Start the server
server.listen(port, () => {
  console.log("Server listening on port " + port);
});
