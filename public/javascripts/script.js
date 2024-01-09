// import { Chess } from "chess.js";
let chess = new Chess();
let board = null;
let $status = $("#status");
let $fen = $("#fen");
let $pgn = $("#pgn");
let $whitePlayer = $("#whitePlayer");
let $blackPlayer = $("#blackPlayer");

const urlParts = window.location.pathname.split("/");
const roomId = urlParts[urlParts.length - 1]; //Should ideally be got from req.params.roomId
const socket = io("ws://localhost:3000");
let chessOrientation = "w";

socket.on("connect", () => {
	socket.emit("join", roomId, handleFailedJoin);

	socket.on("gameStatus", gameStatus => {
		console.log(`received ${JSON.stringify(gameStatus)}`);
		chess.load(gameStatus.fen);

		chessOrientation = gameStatus.orientation || chessOrientation;
		updateStatus(gameStatus);
	});
});

const clipboard = new ClipboardJS(".copy-container");

document.getElementById("roomLink").innerText = window.location.href;

clipboard.on("success", e => {
	document.getElementById("roomLink").innerText = "Copied to clipboard!";

	setTimeout(() => {
		document.getElementById("roomLink").innerText = window.location.href;
	}, 1500);
});

function handleFailedJoin(err) {
	// Redirect back to home page
	alert(err);
	window.location.href = "/home";
}

function onDragStart(source, piece, position, orientation) {
	// do not pick up pieces if the game is over
	if (chess.game_over()) return false;

	const isYourPiece = chessOrientation === "w" ? piece.search(/^w/) !== -1 : piece.search(/^b/) !== -1;
	const isYourTurn =
		(chessOrientation === "w" && chess.turn() === "w") || (chessOrientation === "b" && chess.turn() === "b");

	if (!isYourPiece || !isYourTurn) return false;
}

function onDrop(source, target) {
	// see if the move is legal
	const move = {
		from: source,
		to: target,
		promotion: "q", // NOTE: always promote to a queen for example simplicity
		roomId: roomId,
	};

	const performedMove = chess.move(move);
	socket.emit("gameMove", move);

	// illegal move
	if (performedMove === null) return "snapback";

	updateStatus();
}

// update the board position after the piece snap
// for castling, en passant, pawn promotion
function onSnapEnd() {
	board.position(chess.fen());
}

function updateStatus(gameStatus) {
	var status = "";

	var moveColor = "White";
	if (chess.turn() === "b") {
		moveColor = "Black";
	}

	// checkmate?
	if (chess.in_checkmate()) {
		status = "Game over, " + moveColor + " is in checkmate.";
	}

	// draw?
	else if (chess.in_draw()) {
		status = "Game over, drawn position";
	}

	// game still on
	else {
		status = moveColor + " to move";

		// check?
		if (chess.in_check()) {
			status += ", " + moveColor + " is in check";
		}
	}

	$status.html(status);

	if (gameStatus) {
		if (gameStatus.whitePlayer) $whitePlayer.html("White: " + gameStatus.whitePlayer);
		if (gameStatus.blackPlayer) $blackPlayer.html("Black: " + gameStatus.blackPlayer);

		if (gameStatus.player && gameStatus.player === gameStatus.whitePlayer) {
			$whitePlayer.css("font-weight", "bold");
		} else if (gameStatus.player && gameStatus.player === gameStatus.blackPlayer) {
			$blackPlayer.css("font-weight", "bold");
		}
	}
	$fen.html(chess.fen());
	$pgn.html(chess.pgn());
	var config = {
		draggable: true,
		dropOffBoard: "snapback", // this is the default
		position: chess.fen(),
		onDragStart: onDragStart,
		onDrop: onDrop,
		onSnapEnd: onSnapEnd,
		orientation: chessOrientation === "b" ? "black" : "white",
	};
	board = Chessboard("board", config);

	console.log("status updated");
}
