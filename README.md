# Chess Game Clone for Full Stack Learning
Inspired by: [project-ideas](https://github.com/hkirat/project-ideas)

## Project Description

|  | ♟️ CHESS ♟️ |
| :----: | :---: |
| 01 | Build a multiplayer chess game like https://chess.com |
| 02 | Frontend should allow users to signup, create accounts and create a room |
| 03 | On room creation, they can share the link with their friend who can join the group as well
| 04 | Add move validation to make sure users can only make valid moves
| 05 | Use either canvas or raw HTML blocks for the game. You may also use a game engine like phaser. |
| 06 | You will need to do socket programming since this is a real-time game. |


## How to Install and Run the Project
```bash
    npm install
    npm start
```

## Features
- A user can create an account and login
- A user can create a room and invite other people
- A user can join someon else's room
- A user can play chess once in a room

The server will be running on [localhost:3000](http://localhost:3000)

## Technologies learnt and used for this project

| Tool | Purpose |
| -------- | ------- |
| [Socket.io](https://socket.io) | managing chess moves and game data in real time |
| [Express.js](https://expressjs.com/pt-br/) | easier server config and endpoint routing |
| [chess.js](https://expressjs.com/pt-br/) | chess logic and verifications|
| [chessboard.js](https://chessboardjs.com) | chessboard representation in the frontend |
| [clipboard.js](https://clipboardjs.com)| copying text to clipboard|
| [Node.js](https://nodejs.org/en)| server JavaScript environment |
| [MongoDB](https://www.mongodb.com/pt-br)| storing users and rooms data |
| [Mongoose](https://mongoosejs.com)| interacting with mongoDB using Nodejs |
| [EJS](https://ejs.co)| views templating using javascript |

