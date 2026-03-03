const ASSETS = {
cyan:      "./asset/blocks/block_cyan.png",
yellow:    "./asset/blocks/block_yellow.png",
purple:    "./asset/blocks/block_purple.png",
green:     "./asset/blocks/block_green.png",
red:       "./asset/blocks/block_red.png",
blue:      "./asset/blocks/block_blue.png",
light_red: "./asset/blocks/block_light_red.png",
};

const SFX_DROP = Array.from({length: 5}, (_,i) => `./asset/sfx/sfx_drop_${i}.ogg`);
const SFX_CLEAR = Array.from({length: 2}, (_,i) => `./asset/sfx/sfx_line_clear_${i}.ogg`);
const SFX_GAMEOVER = "./asset/sfx/sfx_gameover.ogg";
const BGM_SRC = "./asset/sfx/sfx_bgm.ogg";

const SFX_CLICK = "./asset/sfx/sfx_click.ogg";
const clickAudio = new Audio(SFX_CLICK);
clickAudio.preload = "auto";

const COLS = 10, ROWS = 18;
const TILE = 50;
const BOARD_W = COLS * TILE;
const BOARD_H = ROWS * TILE;

const LINE_POINTS = [0, 100, 300, 500, 800];

function levelToMs(level) { return Math.max(160, 1100 - (level - 1) * 80); }

const PIECES = {
	I: { key:"cyan", rots:[
		[[0,1],[1,1],[2,1],[3,1]],
		[[2,0],[2,1],[2,2],[2,3]],
		[[0,2],[1,2],[2,2],[3,2]],
		[[1,0],[1,1],[1,2],[1,3]],
	]},
	O: { key:"yellow", rots:[
		[[1,1],[2,1],[1,2],[2,2]],
		[[1,1],[2,1],[1,2],[2,2]],
		[[1,1],[2,1],[1,2],[2,2]],
		[[1,1],[2,1],[1,2],[2,2]],
	]},
	T: { key:"purple", rots:[
		[[1,1],[0,2],[1,2],[2,2]],
		[[1,1],[1,2],[2,2],[1,3]],
		[[0,2],[1,2],[2,2],[1,3]],
		[[1,1],[0,2],[1,2],[1,3]],
	]},
	S: { key:"green", rots:[
		[[1,1],[2,1],[0,2],[1,2]],
		[[1,1],[1,2],[2,2],[2,3]],
		[[1,2],[2,2],[0,3],[1,3]],
		[[0,1],[0,2],[1,2],[1,3]],
	]},
	Z: { key:"red", rots:[
		[[0,1],[1,1],[1,2],[2,2]],
		[[2,1],[1,2],[2,2],[1,3]],
		[[0,2],[1,2],[1,3],[2,3]],
		[[1,1],[0,2],[1,2],[0,3]],
	]},
	J: { key:"blue", rots:[
		[[0,1],[0,2],[1,2],[2,2]],
		[[1,1],[2,1],[1,2],[1,3]],
		[[0,2],[1,2],[2,2],[2,3]],
		[[1,1],[1,2],[0,3],[1,3]],
	]},
	L: { key:"light_red", rots:[
		[[2,1],[0,2],[1,2],[2,2]],
		[[1,1],[1,2],[1,3],[2,3]],
		[[0,2],[1,2],[2,2],[0,3]],
		[[0,1],[1,1],[1,2],[1,3]],
	]},
};


const TYPES = Object.keys(PIECES);

const stageEl = document.getElementById("stage");
const boardWrap = document.getElementById("boardWrap");
const boardCanvas = document.getElementById("board");
const boardCtx = boardCanvas.getContext("2d");

const nextCanvases = [document.getElementById("next0"), document.getElementById("next1"), document.getElementById("next2")];
const nextCtxs = nextCanvases.map(c => c.getContext("2d"));

const holdCanvas = document.getElementById("hold");
const holdCtx = holdCanvas.getContext("2d");

const elScore = document.getElementById("score");
const pauseBtn = document.getElementById("pauseBtn");
const volBtn = document.getElementById("volBtn");
const holdBtn = document.getElementById("holdBtn");
const btnDown = document.getElementById("btnDown");

function setupHiDPI(canvas, cssW, cssH) {
	const dpr = window.devicePixelRatio || 1;
	canvas.style.width = cssW + "px";
	canvas.style.height = cssH + "px";
	canvas.width = Math.floor(cssW * dpr);
	canvas.height = Math.floor(cssH * dpr);
	const ctx = canvas.getContext("2d");
	ctx.setTransform(dpr,0,0,dpr,0,0);
	ctx.imageSmoothingEnabled = false;
	return ctx;
}
function setupCanvases() {
	setupHiDPI(boardCanvas, BOARD_W, BOARD_H);
	nextCanvases.forEach(c => setupHiDPI(c, 140, 110));
	setupHiDPI(holdCanvas, 140, 110);
}
function fitStage() {
	const vv = window.visualViewport;
	const vw = vv ? vv.width : window.innerWidth;
	const vh = vv ? vv.height : window.innerHeight;

	const pad = 20;
	const availW = Math.max(50, vw - pad);
	const availH = Math.max(50, vh - pad);

	const nativeW = 670, nativeH = 970;
	const s = Math.min(availW / nativeW, availH / nativeH);
	stageEl.style.setProperty("--scale", String(s));
}

const imgs = {};
const imgReady = {};
function loadImages() {
	const keys = Object.keys(ASSETS);
	let done = 0;
	return new Promise((resolve) => {
		keys.forEach((k) => {
			const img = new Image();
			imgs[k] = img;
			imgReady[k] = false;
			img.onload = () => { imgReady[k] = true; done++; if (done === keys.length) resolve(); };
			img.onerror = () => { done++; if (done === keys.length) resolve(); };
			img.src = ASSETS[k];
		});
	});
}

function drawTile(ctx, key, x, y, size, alpha=1) {
	const px = x * size, py = y * size;
	ctx.save();
	ctx.globalAlpha = alpha;
	if (imgReady[key] && imgs[key]) ctx.drawImage(imgs[key], px, py, size, size);
	else {
		ctx.fillStyle = "rgba(255,255,255,0.16)";
		ctx.fillRect(px, py, size, size);
		ctx.strokeStyle = "rgba(255,255,255,0.32)";
		ctx.strokeRect(px + 1, py + 1, size - 2, size - 2);
	}
	ctx.restore();
}


// ================================ SFX Audio ================================ //
const VOL_STATES = [
	{name:"mute", icon:"🔇", vol:0},
	{name:"low",  icon:"🔈", vol:0.22},
	{name:"mid",  icon:"🔉", vol:0.50},
	{name:"loud", icon:"🔊", vol:1.00},
];
let volIndex = 2; //default volume
const BGM_MULT = 0.30;
const SFX_MULT = 2.00;

const dropPool = SFX_DROP.map(src => { const a = new Audio(src); a.preload = "auto"; return a; });
const clearPool = SFX_CLEAR.map(src => { const a = new Audio(src); a.preload = "auto"; return a; });
const gameoverAudio = new Audio(SFX_GAMEOVER); gameoverAudio.preload = "auto";
const bgm = new Audio(BGM_SRC); bgm.preload = "auto"; bgm.loop = true;

let audioUnlocked = false;

function getVol(){ return VOL_STATES[volIndex].vol; }

async function unlockAudioIfNeeded() {
	if (audioUnlocked) return;
	audioUnlocked = true;
	try {
		bgm.volume = 0;
		await bgm.play();
		bgm.pause();
		bgm.currentTime = 0;
	} catch (_) {
		// ignore
	} finally {
		bgm.volume = getVol();
	}
	
	if (!paused && !gameOver && getVol() > 0) {
		startBgm(true); // fromStart=true so it begins at 0
	}
}

function applyVolumes() {
	bgm.volume = getVol() * BGM_MULT;
}

function playRandom(pool) {
	if (!audioUnlocked) return;
	const v = getVol();
	if (v <= 0) return;
	const idx = Math.floor(Math.random() * pool.length);
	const a = pool[idx].cloneNode();
	a.volume = Math.min(1, v * SFX_MULT);
	a.currentTime = 0;
	a.play().catch(()=>{});
}
function playDropSfx(){ playRandom(dropPool); }
function playClearSfx(){ playRandom(clearPool); }
function playGameOverSfx(){
	if (!audioUnlocked) return;
	const v = getVol();
	if (v <= 0) return;
	const a = gameoverAudio.cloneNode();
	a.volume = Math.min(1, v * SFX_MULT);
	a.currentTime = 0;
	a.play().catch(()=>{});
}
function playClickSfx(){
	if (!audioUnlocked) return;
	const v = getVol();
	if (v <= 0) return;
	const a = clickAudio.cloneNode();
	a.volume = Math.min(1, v * SFX_MULT ?? v);
	a.currentTime = 0;
	a.play().catch(()=>{});
}

// ----- BGM speed
function computeBgmRate() {
	const base = 1100;
	const normal_speed = base / dropMs;
	const rate = normal_speed * 0.80; //Initial BGM speed
	return Math.min(1.35, Math.max(0.80, rate));
}
function updateBgmRate() { bgm.playbackRate = computeBgmRate(); }

function startBgm(fromStart=false) {
	if (!audioUnlocked) return;
	if (getVol() <= 0) return;
	if (fromStart) { bgm.pause(); bgm.currentTime = 0; }
	applyVolumes();
	updateBgmRate();
	bgm.play().catch(()=>{});
}
function stopBgm(reset=false) {
	bgm.pause();
	if (reset) bgm.currentTime = 0;
}
function cycleVolume() {
	volIndex = (volIndex + 1) % VOL_STATES.length;
	volBtn.textContent = VOL_STATES[volIndex].icon;
	applyVolumes();

	if (getVol() > 0 && !paused && !gameOver) startBgm(false);
	if (getVol() === 0) stopBgm(false);

	playDropSfx();
}


// ================================ Game State ================================ //
let board = null;
let score = 0;
let lines = 0;
let level = 1;

let bag = [];
let current = null;
let hold = null;
let holdUsed = false;
let nextQueue = [];

let paused = false;
let gameOver = false;

let lastTime = 0;
let dropAcc = 0;
let dropMs = levelToMs(1);

function newBoard() { return Array.from({length: ROWS}, () => Array(COLS).fill(null)); }

function onGameOver() {
	if (gameOver) return;
	gameOver = true;
	stopBgm(false);
	playGameOverSfx();
}


// ================================ Game Logics ================================ //
function refillBag() {
	bag = TYPES.slice();
	for (let i = bag.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[bag[i], bag[j]] = [bag[j], bag[i]];
	}
}

function takeFromBag() { 
	if (bag.length === 0) refillBag(); return bag.pop();
}

function spawnPiece(type) {
	const shape0 = PIECES[type].rots[0];
	let minDy = 999;
	for (const [,dy] of shape0) minDy = Math.min(minDy, dy);
	return { type, key: PIECES[type].key, rot: 0, x: 3, y: -minDy };
}

function cellsOf(piece) {
	return PIECES[piece.type].rots[piece.rot].map(([dx,dy]) => [piece.x+dx, piece.y+dy]);
}

function collides(piece) {
	for (const [x,y] of cellsOf(piece)) {
		if (x < 0 || x >= COLS) return true;
		if (y >= ROWS) return true;
		if (y >= 0 && board[y][x]) return true;
	}
	return false;
}

function clearLines() {
	let cleared = 0;
	for (let y = ROWS - 1; y >= 0; y--) {
		if (board[y].every(c => c !== null)) {
			board.splice(y, 1);
			board.unshift(Array(COLS).fill(null));
			cleared++;
			y++;
		}
	}
	if (cleared) {
		lines += cleared;
		score += LINE_POINTS[cleared] * level;
		playClearSfx();
		
		const newLevel = Math.floor(lines / 10) + 1;
		if (newLevel !== level) {
			level = newLevel;
			dropMs = levelToMs(level);
			updateBgmRate();
		}
	}
}

function lockPiece() {
	for (const [x,y] of cellsOf(current)) {
		if (y < 0) { onGameOver(); return; }
		board[y][x] = current.key;
	}
	playDropSfx();
	clearLines();
	holdUsed = false;
	current = spawnPiece(nextQueue.shift());
	nextQueue.push(takeFromBag());
	
	if (collides(current)) onGameOver();
}

function move(dx) {
	if (paused || gameOver) return;
	const t = {...current, x: current.x + dx};
	if (!collides(t)) current = t;
}

function rotateCW() {
	if (paused || gameOver) return;
	const nextRot = (current.rot + 1) % 4;
	const base = {...current, rot: nextRot};
	const kicks = [0,-1,1,-2,2];
	for (const k of kicks) {
		const t = {...base, x: base.x + k};
		if (!collides(t)) { current = t; return; }
	}
}

function softDropOnce(addScore=true) {
	if (paused || gameOver) return false;
	const t = {...current, y: current.y + 1};
	if (!collides(t)) { current = t; if (addScore) score += 1; return true; }
	lockPiece();
	return false;
}

function hardDrop() {
	if (paused || gameOver) return;
	while (true) {
		const t = {...current, y: current.y + 1};
		if (collides(t)) break;
		current = t;
	}
	lockPiece();
}

function doHold() {
	if (paused || gameOver) return;
	if (holdUsed) return;
	holdUsed = true;
	
	if (!hold) {
		hold = current.type;
		current = spawnPiece(nextQueue.shift());
		nextQueue.push(takeFromBag());
	} else {
		const tmp = hold;
		hold = current.type;
		current = spawnPiece(tmp);
	}
	
	current.x = 3;
	current.rot = 0;
	
	// ensure fully visible after hold spawn
	const shape0 = PIECES[current.type].rots[0];
	let minDy = 999;
	for (const [,dy] of shape0) minDy = Math.min(minDy, dy);
	current.y = -minDy;
	
	if (collides(current)) onGameOver();
}


// ================================ Preview ================================ //
function ghostOf(piece) {
	let g = {...piece};
	while (true) {
		const t = {...g, y: g.y + 1};
		if (collides(t)) break;
		g = t;
	}
	return g;
}


// ================================ Rendering ================================ //
function clear(ctx,w,h){ ctx.clearRect(0,0,w,h); }
function drawGrid() {
	boardCtx.save();
	boardCtx.strokeStyle = "rgba(255,255,255,0.06)";
	for (let x=1; x<COLS; x++){
		boardCtx.beginPath(); boardCtx.moveTo(x*TILE,0); boardCtx.lineTo(x*TILE,BOARD_H); boardCtx.stroke();
	}
	for (let y=1; y<ROWS; y++){
		boardCtx.beginPath(); boardCtx.moveTo(0,y*TILE); boardCtx.lineTo(BOARD_W,y*TILE); boardCtx.stroke();
	}
	boardCtx.restore();
}

function drawBoard() {
	clear(boardCtx, BOARD_W, BOARD_H);

	for (let y=0; y<ROWS; y++){
		for (let x=0; x<COLS; x++){
			const cell = board[y][x];
			if (cell) drawTile(boardCtx, cell, x, y, TILE, 1);
		}
	}
	if (current && !gameOver) {
		const g = ghostOf(current);
		for (const [x,y] of cellsOf(g)) if (y >= 0) drawTile(boardCtx, g.key, x, y, TILE, 0.25);
		for (const [x,y] of cellsOf(current)) if (y >= 0) drawTile(boardCtx, current.key, x, y, TILE, 1);
	}
	drawGrid();
	
	if (paused && !gameOver) {
		boardCtx.save();
		boardCtx.fillStyle = "rgba(0,0,0,0.45)";
		boardCtx.fillRect(0,0,BOARD_W,BOARD_H);
		boardCtx.fillStyle = "rgba(255,255,255,0.95)";
		boardCtx.textAlign = "center";
		boardCtx.font = "900 56px system-ui, sans-serif";
		boardCtx.fillText("PAUSED", BOARD_W/2, BOARD_H/2);
		boardCtx.restore();
	}
	if (gameOver) {
		boardCtx.save();
		boardCtx.fillStyle = "rgba(0,0,0,0.55)";
		boardCtx.fillRect(0,0,BOARD_W,BOARD_H);
		boardCtx.fillStyle = "rgba(255,255,255,0.95)";
		boardCtx.textAlign = "center";
		boardCtx.font = "900 56px system-ui, sans-serif";
		boardCtx.fillText("GAME OVER", BOARD_W/2, BOARD_H/2 - 10);
		boardCtx.font = "700 18px system-ui, sans-serif";
		boardCtx.fillText("Tap board / press R to restart", BOARD_W/2, BOARD_H/2 + 28);
		boardCtx.restore();
	}
}

function drawMini(ctx, type) {
	const W = 140, H = 110;
	clear(ctx, W, H);
	if (!type) return;
	
	const tile = 22;
	const shape = PIECES[type].rots[0];
	
	let minX=99, minY=99, maxX=-99, maxY=-99;
	for (const [dx,dy] of shape) {
		minX = Math.min(minX, dx); minY = Math.min(minY, dy);
		maxX = Math.max(maxX, dx); maxY = Math.max(maxY, dy);
	}
	const shapeW = (maxX - minX + 1) * tile;
	const shapeH = (maxY - minY + 1) * tile;
	const offX = Math.floor((W - shapeW) / 2) - minX * tile;
	const offY = Math.floor((H - shapeH) / 2) - minY * tile;
	
	for (const [dx,dy] of shape) {
		const px = offX + dx*tile;
		const py = offY + dy*tile;
		const key = PIECES[type].key;
		if (imgReady[key] && imgs[key]) ctx.drawImage(imgs[key], px, py, tile, tile);
		else {
			ctx.fillStyle = "rgba(255,255,255,0.16)";
			ctx.fillRect(px, py, tile, tile);
			ctx.strokeStyle = "rgba(255,255,255,0.30)";
			ctx.strokeRect(px+1, py+1, tile-2, tile-2);
		}
	}
}
function renderHUD() {
	elScore.textContent = String(score);
	for (let i=0; i<3; i++) drawMini(nextCtxs[i], nextQueue[i]);
	drawMini(holdCtx, hold);
}
function renderAll() { if (!board) return; drawBoard(); renderHUD(); }


// ================================ Hint Section ================================ //
const tabKeyboard = document.getElementById("tabKeyboard");
const tabMobile = document.getElementById("tabMobile");
const hintKeyboard = document.getElementById("hintKeyboard");
const hintMobile = document.getElementById("hintMobile");

function setHintMode(mode) {
	const isKeyboard = mode === "keyboard";
	tabKeyboard.setAttribute("aria-pressed", String(isKeyboard));
	tabMobile.setAttribute("aria-pressed", String(!isKeyboard));

	hintKeyboard.style.display = isKeyboard ? "" : "none";
	hintMobile.style.display = isKeyboard ? "none" : "";
}

tabKeyboard.addEventListener("click", () => setHintMode("keyboard"));
tabMobile.addEventListener("click", () => setHintMode("mobile"));

function isProbablyMobile() {
	const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
	const smallScreen = Math.min(window.innerWidth, window.innerHeight) <= 820;
	const uaMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
	return coarse || uaMobile || smallScreen;
}
setHintMode(isProbablyMobile() ? "mobile" : "keyboard");


// ================================ Holding Inputs ================================ //
const input = {
	left:false, right:false, down:false, rotate:false,
	leftTime:0, rightTime:0, downTime:0, rotateTime:0,
	leftRepeats:0, rightRepeats:0, rotateRepeats:0
};
const DAS = 170, ARR = 55, ROT_DAS = 220, ROT_ARR = 120, SOFT_ARR = 45;

function resetHold(which) {
	if (which === "left") { input.leftTime=0; input.leftRepeats=0; }
	if (which === "right"){ input.rightTime=0; input.rightRepeats=0; }
	if (which === "rotate"){ input.rotateTime=0; input.rotateRepeats=0; }
}

function handleHeld(dt) {
	if (paused || gameOver) return;

	if (input.left && !input.right) {
		input.leftTime += dt;
		if (input.leftTime >= DAS) {
			const reps = Math.floor((input.leftTime - DAS) / ARR);
			while (input.leftRepeats < reps) { move(-1); input.leftRepeats++; }
		}
	}
	if (input.right && !input.left) {
		input.rightTime += dt;
		if (input.rightTime >= DAS) {
			const reps = Math.floor((input.rightTime - DAS) / ARR);
			while (input.rightRepeats < reps) { move(1); input.rightRepeats++; }
		}
	}
	if (input.rotate) {
		input.rotateTime += dt;
		if (input.rotateTime >= ROT_DAS) {
			const reps = Math.floor((input.rotateTime - ROT_DAS) / ROT_ARR);
			while (input.rotateRepeats < reps) { rotateCW(); input.rotateRepeats++; }
		}
	}
	if (input.down) {
		input.downTime += dt;
		while (input.downTime >= SOFT_ARR) {
			input.downTime -= SOFT_ARR;
			softDropOnce(false);
			if (gameOver) break;
		}
	}
}


// ================================ Keyboard Controls ================================ //
window.addEventListener("keydown", async (e) => {
	await unlockAudioIfNeeded();

	const k = e.key;
	if (["ArrowLeft","ArrowRight","ArrowDown","ArrowUp"," "].includes(k)) e.preventDefault();

	if (k === "r" || k === "R") { restart(); return; }
	if (k === "p" || k === "P") { togglePause(); return; }

	if (paused || gameOver) return;

	if (k === "ArrowLeft" && !input.left) { input.left = true; resetHold("left"); move(-1); }
	else if (k === "ArrowRight" && !input.right){ input.right = true; resetHold("right"); move(1); }
	else if (k === "ArrowDown" && !input.down){ input.down = true; input.downTime = 0; softDropOnce(); }
	else if (k === "ArrowUp" && !input.rotate){ input.rotate = true; resetHold("rotate"); rotateCW(); }
	else if (k === " ") { hardDrop(); }
	else if (k === "c" || k === "C" || k === "Shift") { doHold(); }
}, {passive:false});

window.addEventListener("keyup", (e) => {
	const k = e.key;
	if (k === "ArrowLeft") { input.left=false; resetHold("left"); }
	else if (k === "ArrowRight"){ input.right=false; resetHold("right"); }
	else if (k === "ArrowDown"){ input.down=false; input.downTime=0; }
	else if (k === "ArrowUp"){ input.rotate=false; resetHold("rotate"); }
}, {passive:false});


// ================================ Buttons ================================ //
function updatePauseIcon() { pauseBtn.textContent = paused ? "▶" : "⏸"; }

function togglePause() {
	if (gameOver) return;
	paused = !paused;
	updatePauseIcon();
	if (paused) stopBgm(false);
	else startBgm(false);
}
pauseBtn.addEventListener("click", async (e) => { e.preventDefault(); await unlockAudioIfNeeded(); playClickSfx(); togglePause(); }, {passive:false});
volBtn.addEventListener("click", async (e) => { e.preventDefault(); await unlockAudioIfNeeded(); cycleVolume(); }, {passive:false});

holdBtn.addEventListener("pointerdown", async (e) => {
	e.preventDefault(); e.stopPropagation();
	await unlockAudioIfNeeded();
	if (gameOver) { restart(); return; }
	doHold();
	renderAll();
}, {passive:false});


// ================================ Mobile Controls ================================ //
// Down: tap = hard drop; hold = fast drop
let downPressT0 = 0;
let downSoftArmed = false;
let downArmTimer = null;

const DROP_TAP_COOLDOWN_MS = 150; //buffer to prevent accidental spam drop
let downHandled = false;
let downActivePointerId = null;
let downLockUntil = 0;

async function downPointerDown(e) {
	const now = performance.now();
	if (now < downLockUntil) { e.preventDefault(); e.stopPropagation(); return; }
	downHandled = false;
	downActivePointerId = e.pointerId;
	
	await unlockAudioIfNeeded();
	if (gameOver) { restart(); return; }
	if (paused) return;

	downPressT0 = performance.now();
	downSoftArmed = false;

	downArmTimer = setTimeout(() => {
		downSoftArmed = true;
		input.down = true;
		input.downTime = 0;
		softDropOnce(false);
		renderAll();
	}, 160);
	btnDown.setPointerCapture?.(e.pointerId);
}
function downPointerUp(e) {
	if (downHandled) return;
	if (downActivePointerId !== null && e.pointerId !== downActivePointerId) return;
	downHandled = true;
	downActivePointerId = null;
	
	const dt = performance.now() - downPressT0;
	
	if (downArmTimer) { clearTimeout(downArmTimer); downArmTimer = null; }
	if (input.down) { input.down = false; input.downTime = 0; }
	if (!downSoftArmed && dt < 160 && !paused && !gameOver) {
		hardDrop();
		downLockUntil = performance.now() + DROP_TAP_COOLDOWN_MS;
	}

	downSoftArmed = false;
	renderAll();
}
btnDown.addEventListener("pointerdown", downPointerDown, {passive:false});
btnDown.addEventListener("pointerup", downPointerUp, {passive:false});
btnDown.addEventListener("pointercancel", downPointerUp, {passive:false});
btnDown.addEventListener("pointerleave", downPointerUp, {passive:false});

// --- Drag to move (mobile), tap to rotate ---
const DRAG_DEADZONE_PX = 10;   // how far finger must move before we treat it as a drag
let drag = {
	active: false,
	pointerId: null,
	lastX: 0,
	accumX: 0,
	moved: false,
	cellPx: 0,
	holdTimer: null,
	rotatingHold: false,
};
function cellSizeOnScreen() {
	const r = boardWrap.getBoundingClientRect();
	return r.width / COLS; // stage scaling-safe
}
function stopRotateHold() {
	input.rotate = false;
	resetHold("rotate");
	drag.rotatingHold = false;
}
boardWrap.addEventListener("pointerdown", async (e) => {
	if (e.target && e.target.closest && e.target.closest(".pads")) return;

	if (gameOver) { restart(); return; }
	if (paused) return;

	e.preventDefault();
	await unlockAudioIfNeeded();

	drag.active = true;
	drag.pointerId = e.pointerId;
	drag.lastX = e.clientX;
	drag.accumX = 0;
	drag.moved = false;
	drag.cellPx = cellSizeOnScreen();
	drag.rotatingHold = false;

	// If user holds finger still, enable rotate-hold (repeat rotate)
	drag.holdTimer = setTimeout(() => {
		if (!drag.active || drag.moved) return;
		drag.rotatingHold = true;
		input.rotate = true;
		resetHold("rotate");
		rotateCW();
	}, ROT_DAS);
	boardWrap.setPointerCapture?.(e.pointerId);
}, { passive: false });

boardWrap.addEventListener("pointermove", (e) => {
	if (!drag.active || e.pointerId !== drag.pointerId) return;

	const dx = e.clientX - drag.lastX;
	drag.lastX = e.clientX;
	drag.accumX += dx;

	if (!drag.moved && Math.abs(drag.accumX) > DRAG_DEADZONE_PX) {
		drag.moved = true;
		if (drag.holdTimer) { clearTimeout(drag.holdTimer); drag.holdTimer = null; }
		if (drag.rotatingHold) stopRotateHold();
	}
	if (!drag.moved) return;
	
	const step = drag.cellPx || cellSizeOnScreen();
	let steps = Math.trunc(drag.accumX / step);
	if (steps !== 0) {
		const dir = Math.sign(steps);
		steps = Math.abs(steps);
		for (let i = 0; i < steps; i++) move(dir);  // move(-1) or move(+1)
		drag.accumX -= dir * steps * step;
	}
	renderAll();
}, { passive: false });

function endDrag(e) {
	if (!drag.active || e.pointerId !== drag.pointerId) return;
	if (drag.holdTimer) { clearTimeout(drag.holdTimer); drag.holdTimer = null; }
	if (!drag.moved && !drag.rotatingHold && !paused && !gameOver) {
		rotateCW();
	}
	if (drag.rotatingHold) stopRotateHold();
	drag.active = false;
	drag.pointerId = null;
	drag.accumX = 0;
	drag.moved = false;
	renderAll();
}
boardWrap.addEventListener("pointerup", endDrag, { passive: false });
boardWrap.addEventListener("pointercancel", endDrag, { passive: false });
boardWrap.addEventListener("pointerleave", endDrag, { passive: false });


// ================================ Prevents Zooming in on IOS ================================ //
const stage = document.getElementById("stage");
let lastTapTime = 0;
stage.addEventListener("touchend", (e) => {
	const now = Date.now();
	if (now - lastTapTime < 300) e.preventDefault();
	lastTapTime = now;
}, { passive: false });


// ================================ Game Loop ================================ //
function tick(t) {
	const dt = t - lastTime;
	lastTime = t;
	if (!paused && !gameOver) {
		handleHeld(dt);
		dropAcc += dt;
		while (dropAcc >= dropMs) {
			dropAcc -= dropMs;
			const moved = softDropOnce(false);
			if (!moved) break;
			if (gameOver) break;
		}
	}
	renderAll();
	requestAnimationFrame(tick);
}


// ================================ Restart ================================ //
function restart() {
	board = newBoard();
	score = 0; lines = 0; level = 1;
	dropMs = levelToMs(level);
	paused = false; gameOver = false;
	hold = null; holdUsed = false;
	dropAcc = 0;

	refillBag();
	nextQueue = [takeFromBag(), takeFromBag(), takeFromBag()];
	current = spawnPiece(takeFromBag());

	updatePauseIcon();
	updateBgmRate();
	stopBgm(true);
	startBgm(true);
	renderAll();
}


// ================================ Boot ================================ //
function boot() {
	setupCanvases();
	fitStage();
	window.addEventListener("resize", () => { setupCanvases(); fitStage(); renderAll(); }, {passive:true});
	if (window.visualViewport) {
		window.visualViewport.addEventListener("resize", () => { setupCanvases(); fitStage(); renderAll(); }, {passive:true});
		window.visualViewport.addEventListener("scroll", () => { fitStage(); }, {passive:true});
	}

	volBtn.textContent = VOL_STATES[volIndex].icon;
	applyVolumes();
	updatePauseIcon();
	
	window.addEventListener("pointerdown", () => unlockAudioIfNeeded(), { once: true });
	restart();

	lastTime = performance.now();
	requestAnimationFrame(tick);
}
loadImages().then(boot);
