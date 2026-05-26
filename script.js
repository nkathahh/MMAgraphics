const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const restartBtn = document.getElementById("restartBtn");

canvas.width = 800;
canvas.height = 500;

/*1. APPLICATION STAGE - Handling game state, input, and game clock*/
let score = 0;
let lives = 3;
let gameOver = false;
let gameStarted = false;
let speed = 2;
let paused = false;
let shiftPressed = false;        
let newHighScoreAchieved = false; 

// Audio sources
const catchSound = new Audio("https://actions.google.com/sounds/v1/cartoon/pop.ogg");
const bombSound = new Audio("https://actions.google.com/sounds/v1/explosions/explosion.ogg");
const gameOverSound = new Audio("https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg");

// Object 1: Player (Basket) Definiton
const basket = {
    x: canvas.width / 2 - 50,
    y: canvas.height - 60,
    width: 100,
    height: 20,
    speed: 7,
    dx: 0
};

// Object 2 & 3: Dynamic dropping objects, UI feedback track arrays, and particles
const objects = [];
const popups = [];
const particles = []; 

// Input handling (Application Stage)
document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") basket.dx = -basket.speed;
    if (e.key === "ArrowRight") basket.dx = basket.speed;
    if (e.key === " ") gameStarted = true;
    if (e.key === "Shift") shiftPressed = true; // Activate Turbo Boost

    if (e.key === "p" || e.key === "P") {
        if (gameStarted && !gameOver) {
            paused = !paused;
        }
    }
});

document.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") basket.dx = 0;
    if (e.key === "Shift") shiftPressed = false; // Deactivate Turbo Boost
});

function createObject() {
    const isBomb = Math.random() < 0.2;
    const object = {
        x: Math.random() * (canvas.width - 40),
        y: -40,
        radius: 20,
        speed: speed + Math.random() * 2,
        type: isBomb ? "bomb" : "fruit",
        color: isBomb ? "black" : randomFruitColor(),
        angle: 0
    };
    objects.push(object);
}

function randomFruitColor() {
    const colors = ["red", "orange", "lime", "yellow", "pink"];
    return colors[Math.floor(Math.random() * colors.length)];
}

setInterval(() => {
    if (!gameOver && gameStarted) {
        createObject();
    }
}, 1000);


/*2. GEOMETRY STAGE
   Handling tracking coordinates, collisions, and matrix math (translations/rotations)*/

// Helper logic to generate random vectors for exploding bits
function spawnExplosion(x, y, color) {
    for (let i = 0; i < 12; i++) {
        particles.push({
            x: x,
            y: y,
            dx: (Math.random() - 0.5) * 6,
            dy: (Math.random() - 0.5) * 6,
            radius: Math.random() * 3 + 1,
            color: color,
            timer: 20 // frame lifetime
        });
    }
}

function update() {
    // Modify player model coordinates (Apply Turbo Boost calculation)
    let currentMultiplier = shiftPressed ? 1.8 : 1;
    basket.x += basket.dx * currentMultiplier;

    // Viewport clamping (keeping basket inside canvas)
    if (basket.x < 0) basket.x = 0;
    if (basket.x + basket.width > canvas.width) basket.x = canvas.width - basket.width;

    // Transform score popup locations (drifting upward)
    for (let i = popups.length - 1; i >= 0; i--) {
        popups[i].y -= 1;
        popups[i].timer -= 1;
        if (popups[i].timer <= 0) popups.splice(i, 1);
    }

    // Transform and update geometry positions for particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].x += particles[i].dx;
        particles[i].y += particles[i].dy;
        particles[i].timer -= 1;
        if (particles[i].timer <= 0) particles.splice(i, 1);
    }

    // Process coordinates for falling objects
    for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        obj.y += obj.speed; // Translation step
        obj.angle += 0.05;  // Rotation step

        // Collision Detection geometry matrix calculations
        if (
            obj.y + obj.radius > basket.y &&
            obj.x > basket.x &&
            obj.x < basket.x + basket.width
        ) {
            if (obj.type === "fruit") {
                score += 10;
                catchSound.play();
                popups.push({ x: obj.x, y: basket.y - 10, timer: 30 });
                spawnExplosion(obj.x, obj.y, obj.color);
            } else {
                lives--;
                bombSound.play();
                spawnExplosion(obj.x, obj.y, "red"); 
            }
            objects.splice(i, 1);
            continue;
        }

        // Out of bounds screen clipping geometry check
        if (obj.y > canvas.height) {
            if (obj.type === "fruit") lives--;
            objects.splice(i, 1);
        }
    }

    speed += 0.0005;

    let currentHighScore = localStorage.getItem("highscore") || 0;
    
    if (score > currentHighScore && currentHighScore > 0) {
        newHighScoreAchieved = true;
    }

    if (score > currentHighScore) {
        localStorage.setItem("highscore", score);
    }

    if (lives <= 0 && !gameOver) {
        gameOver = true;
        gameOverSound.play();
        restartBtn.style.display = "block"; 
    }
}


/*3. RASTERIZATION STAGE
   Converting vector positions, lines, arcs and math variables into actual pixel arrays on screen*/

function drawBasket() {
    ctx.fillStyle = "brown";
    ctx.shadowBlur = 15;
    ctx.shadowColor = "orange";
    
    // Pixel filling primitive shape
    ctx.fillRect(basket.x, basket.y, basket.width, basket.height);
    ctx.shadowBlur = 0;
}

function drawObjects() {
    objects.forEach((obj) => {
        ctx.save();

        // Pass matrices down from Geometry space into local coordinate space
        ctx.translate(obj.x, obj.y);
        ctx.rotate(obj.angle);
        ctx.globalAlpha = 0.9;

        if (obj.type === "fruit") {
            ctx.shadowBlur = 15;
            ctx.shadowColor = obj.color;

            // Mapping arc formulas to filled fragments
            ctx.beginPath();
            ctx.fillStyle = obj.color;
            ctx.arc(0, 0, obj.radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "green";
            ctx.fillRect(-2, -25, 4, 10);
        } else {
            ctx.shadowBlur = 15;
            ctx.shadowColor = "red";

            // Drawing bomb body primitive
            ctx.beginPath();
            ctx.fillStyle = "black";
            ctx.arc(0, 0, obj.radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = "white";
            ctx.beginPath();
            ctx.moveTo(0, -20);
            ctx.lineTo(10, -30);
            ctx.stroke();
        }
        ctx.restore();
    });

    // Rasterizing active particle vectors to color coordinates
    particles.forEach((p) => {
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawUI() {
    ctx.fillStyle = "white";
    ctx.font = "24px Arial";

    // Game Title centered at top
    ctx.textAlign = "center";
    ctx.fillText("FRUIT CATCHER", canvas.width / 2, 35);

    // Left alignment raster text processing (Score & Lives Stack)
    ctx.textAlign = "left";
    ctx.fillText(`Score: ${score}`, 20, 40);
    ctx.fillText("Lives: ", 20, 75);

    // Rasterizing font characters for hearts
    let heartText = "";
    for (let i = 0; i < lives; i++) {
        heartText += "❤️ ";
    }
    ctx.fillText(heartText, 95, 75);

    // Right alignment raster text processing (High Score System Layout)
    ctx.textAlign = "right";
    let displayedHighScore = localStorage.getItem("highscore") || 0;
    ctx.fillText(`High Score: ${displayedHighScore}`, canvas.width - 20, 40);

    // Live feedback alert if player passes historical milestones
    if (newHighScoreAchieved && !gameOver) {
        ctx.save();
        ctx.fillStyle = "yellow";
        ctx.font = "bold 16px Arial";
        ctx.fillText("NEW HIGH SCORE!", canvas.width - 20, 75);
        ctx.restore();
    }

    // Rasterizing floating numbers on data points
    popups.forEach(pop => {
        ctx.fillStyle = "lime";
        ctx.font = "bold 20px Arial";
        ctx.fillText("+10", pop.x, pop.y);
    });

    if (!gameStarted) {
        ctx.textAlign = "center";
        
        ctx.fillStyle = "cyan";
        ctx.font = "36px Arial";
        ctx.fillText("Press SPACE to Start", canvas.width / 2, 210);

        ctx.fillStyle = "white";
        ctx.font = "20px Arial";
        ctx.fillText("Hold SHIFT to Move Quicker", canvas.width / 2, 270);
        ctx.fillText("Press P to Pause the Game", canvas.width / 2, 310);
    }

    if (gameOver) {
        ctx.textAlign = "center";
        ctx.fillStyle = "red";
        ctx.font = "50px Arial";
        ctx.fillText("GAME OVER", canvas.width / 2, 220);

        ctx.fillStyle = "white";
        ctx.font = "30px Arial";
        ctx.fillText(`Final Score: ${score}`, canvas.width / 2, 280);
    }
}

function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#0f172a");
    gradient.addColorStop(1, "#020617");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

function resetGame() {
    score = 0;
    lives = 3;
    speed = 2;
    gameOver = false;
    gameStarted = true;
    paused = false;
    newHighScoreAchieved = false;
    objects.length = 0; 
    popups.length = 0;  
    particles.length = 0; // Reset array states
    restartBtn.style.display = "none"; 
}

/*MAIN GAME LOOP ENGINE Continually ticking through the pipeline frames*/
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBackground();

    if (!gameOver && gameStarted && !paused) {
        update(); 
    }

    drawBasket();
    drawObjects();
    drawUI();

    if (paused) {
        ctx.textAlign = "center";
        ctx.fillStyle = "yellow";
        ctx.font = "40px Arial";
        ctx.fillText("GAME PAUSED", canvas.width / 2, canvas.height / 2);
    }

    requestAnimationFrame(animate);
}

animate();