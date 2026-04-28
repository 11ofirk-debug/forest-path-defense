const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const livesDisplay = document.getElementById("lives");
const goldDisplay = document.getElementById("gold");
const messageDisplay = document.getElementById("message");
const towerButton = document.getElementById("towerButton");
const lumberjackImage = new Image();
lumberjackImage.src = "images/lumberjack.png";
const catapultImage = new Image();
catapultImage.src = "images/catapult.png";

const tileSize = 40;
const rows = canvas.height / tileSize;
const cols = canvas.width / tileSize;

let lives = 10;
let gold = 100;
let placingTower = false;

let enemies = [];
let wave = 1;
let enemiesToSpawn = 0;
let spawnTimer = 0;
let spawnDelay = 60; // frames (~1 second)
let betweenWaves = true;
let waveTimer = 180; // delay before next wave (~3 seconds)
function updateWaves() {
    if (betweenWaves) {
        waveTimer--;

        if (waveTimer <= 0) {
            startWave();
        }

        return;
    }

    if (enemiesToSpawn > 0) {
        spawnTimer--;

        if (spawnTimer <= 0) {
            spawnEnemy();
            enemiesToSpawn--;
            spawnTimer = spawnDelay;
        }
    }

    // wave finished
    if (enemiesToSpawn === 0 && enemies.length === 0) {
        betweenWaves = true;
        wave++;
        waveTimer = 180;

        updateUI();
    }
}
function startWave() {
    betweenWaves = false;
    enemiesToSpawn = 5 + wave * 2;
    spawnTimer = 0;

    updateUI();
}
function spawnEnemy() {
    enemies.push({
    pathIndex: 0,
    x: path[0].x * tileSize,
    y: path[0].y * tileSize,
    speed: 1,
    hp: 3,
    dirX: 1
    });
}

const path = [
    { x: 0, y: 5 },
    { x: 1, y: 5 },
    { x: 2, y: 5 },
    { x: 3, y: 5 },
    { x: 4, y: 5 },
    { x: 5, y: 5 },
    { x: 6, y: 5 },
    { x: 7, y: 5 },
    { x: 8, y: 5 },
    { x: 9, y: 5 },
    { x: 10, y: 5 },
    { x: 11, y: 5 },
    { x: 12, y: 5 },
    { x: 13, y: 5 },
    { x: 14, y: 5 },
    { x: 15, y: 5 }
];

let towers = [];

towerButton.addEventListener("click", function () {
    placingTower = true;
    messageDisplay.innerText = "Choose a forest tile for your Wooden Tower.";
});

canvas.addEventListener("click", function (event) {
    if (!placingTower) {
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const tileX = Math.floor(mouseX / tileSize);
    const tileY = Math.floor(mouseY / tileSize);

    if (isPathTile(tileX, tileY)) {
        messageDisplay.innerText = "You can't build on the path.";
        return;
    }

    if (gold < 50) {
        messageDisplay.innerText = "Not enough gold.";
        return;
    }

    towers.push({
    x: tileX,
    y: tileY,
    range: 120,
    damage: 1,
    fireRate: 60,
    cooldown: 0,
    target: null
});

    gold -= 50;
    placingTower = false;
    updateUI();
    messageDisplay.innerText = "Wooden Tower placed.";
});

function isPathTile(x, y) {
    return path.some(tile => tile.x === x && tile.y === y);
}

function updateUI() {
    livesDisplay.innerText = lives;
    goldDisplay.innerText = gold;
    waveDisplay.innerText = wave;
}

function drawGrid() {
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
            ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }
    }
}

function drawPath() {
    ctx.fillStyle = "#9b7653";

    for (let tile of path) {
        ctx.fillRect(
            tile.x * tileSize,
            tile.y * tileSize,
            tileSize,
            tileSize
        );
    }
}

function drawTowers() {
    for (let tower of towers) {
        let towerCenterX = tower.x * tileSize + tileSize / 2;
        let towerCenterY = tower.y * tileSize + tileSize / 2;

        // tower body
        const towerX = tower.x * tileSize;
        const towerY = tower.y * tileSize;

        ctx.drawImage(
            catapultImage,
            towerX - 6,
            towerY - 14,
            tileSize + 12,
            tileSize + 18
        );

        // range circle
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.beginPath();
        ctx.arc(towerCenterX, towerCenterY, tower.range, 0, Math.PI * 2);
        ctx.stroke();

        // shot line
        if (tower.target && !tower.target.dead) {
            ctx.strokeStyle = "yellow";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(towerCenterX, towerCenterY);
            ctx.lineTo(
                tower.target.x + tileSize / 2,
                tower.target.y + tileSize / 2
            );
            ctx.stroke();
            ctx.lineWidth = 1;
        }
    }
}
function updateTowers() {
    for (let tower of towers) {
        if (tower.cooldown > 0) {
            tower.cooldown--;
            tower.target = null;
            continue;
        }

        let towerCenterX = tower.x * tileSize + tileSize / 2;
        let towerCenterY = tower.y * tileSize + tileSize / 2;

        let closestEnemy = null;
        let closestDistance = Infinity;

        for (let enemy of enemies) {
            let enemyCenterX = enemy.x + tileSize / 2;
            let enemyCenterY = enemy.y + tileSize / 2;

            let dx = enemyCenterX - towerCenterX;
            let dy = enemyCenterY - towerCenterY;
            let distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= tower.range && distance < closestDistance) {
                closestEnemy = enemy;
                closestDistance = distance;
            }
        }

        if (closestEnemy) {
            closestEnemy.hp -= tower.damage;
            tower.cooldown = tower.fireRate;
            tower.target = closestEnemy;

            if (closestEnemy.hp <= 0) {
                closestEnemy.dead = true;
                gold += 5;
                updateUI();
            }
        }
    }

    enemies = enemies.filter(e => !e.dead);
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    updateWaves();
    updateEnemies();
    updateTowers();

    drawPath();
    drawTowers();
    drawEnemies();
    drawGrid();

    updateUI();

    requestAnimationFrame(gameLoop);
}
const waveDisplay = document.getElementById("wave");
function updateEnemies() {
    
    for (let enemy of enemies) {
        let targetTile = path[enemy.pathIndex + 1];

        if (!targetTile) {
            // reached end
            lives--;
            updateUI();
            enemy.dead = true;
            continue;
        }

        let targetX = targetTile.x * tileSize;
        let targetY = targetTile.y * tileSize;

        let dx = targetX - enemy.x;
        let dy = targetY - enemy.y;

        let distance = Math.sqrt(dx * dx + dy * dy);
        enemy.dirX = Math.sign(dx);

        if (distance < enemy.speed) {
            enemy.pathIndex++;
        } else {
            enemy.x += (dx / distance) * enemy.speed;
            enemy.y += (dy / distance) * enemy.speed;
        }
    }

    // remove dead enemies
    enemies = enemies.filter(e => !e.dead);
}

function drawEnemies() {
    const spriteWidth = tileSize;
    const spriteHeight = tileSize * 1.4;

    for (let enemy of enemies) {
        const drawX = enemy.x;
        const drawY = enemy.y - (spriteHeight - tileSize);

        // Flip based on direction
        if (enemy.dirX < 0) {
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(
                lumberjackImage,
                -drawX - spriteWidth,
                drawY,
                spriteWidth,
                spriteHeight
            );
            ctx.restore();
        } else {
            ctx.drawImage(
                lumberjackImage,
                drawX,
                drawY,
                spriteWidth,
                spriteHeight
            );
        }

        // HP bar
        ctx.fillStyle = "red";
        ctx.fillRect(drawX + 5, drawY - 8, 30, 4);

        ctx.fillStyle = "lime";
        ctx.fillRect(drawX + 5, drawY - 8, 30 * (enemy.hp / 3), 4);
    }
}


updateUI();
gameLoop();