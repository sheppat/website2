// =====================
// STARFIELD WITH PARALLAX
// =====================
const canvas = document.getElementById('space');
const ctx = canvas.getContext('2d');
let stars = [];
let mouse = { x: null, y: null };

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const starCount = 200; 
for (let i = 0; i < starCount; i++) {
    stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 1,
        vx: (Math.random() - 0.5) * 0.1,
        vy: (Math.random() - 0.5) * 0.1,
        depth: Math.random() * 1.5 + 0.5
    });
}

window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(star => {
        star.x += star.vx;
        star.y += star.vy;

        if(mouse.x !== null && mouse.y !== null) {
            let dx = (mouse.x - canvas.width/2) * 0.0005 * star.depth;
            let dy = (mouse.y - canvas.height/2) * 0.0005 * star.depth;
            star.x = lerp(star.x, star.x + dx * 10, 0.05);
            star.y = lerp(star.y, star.y + dy * 10, 0.05);
        }

        if(star.x > canvas.width) star.x = 0;
        if(star.x < 0) star.x = canvas.width;
        if(star.y > canvas.height) star.y = 0;
        if(star.y < 0) star.y = canvas.height;

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });

    requestAnimationFrame(animate);
}
animate();

// =====================
// UTILITIES LIST & MODAL
// =====================
fetch('utilities.json')
    .then(res => res.json())
    .then(data => {
        const ul = document.getElementById('utilities-list');
        if(!ul) return;

        const latestVersion = data.reduce((max, util) => {
            const verNum = parseFloat(util.version);
            return verNum > max ? verNum : max;
        }, 0);

        data.forEach(util => {
            const li = document.createElement('li');

            let badgeText = util.version == latestVersion ? 'Latest' : `v${util.version}`;
            li.innerHTML = `
                <h3>${util.name} <span class="version-badge">${badgeText}</span></h3>
                <p>${util.description}</p>
                <p><strong>Release Date:</strong> ${util.release_date}</p>
                <div class="coming-soon">${util.coming_soon ? '<span class="count-badge">Coming Soon</span>' : ''}</div>
                <div class="download-count">Downloads: <span id="dl-${util.id}">${util.downloads || 0}</span></div>
            `;

            if (!util.coming_soon) {
                const btn = document.createElement('button');
                btn.className = 'download-btn';
                btn.innerHTML = '⬇️ Download';
                btn.onclick = (e) => {
                    e.stopPropagation();
                    incrementDownload(util.id);
                    window.location.href = util.file;
                };
                li.appendChild(btn);
            }

            li.addEventListener('click', () => openModal(util));
            ul.appendChild(li);

            setTimeout(() => {
                li.style.opacity = 1;
                li.style.transform = 'translateY(0)';
            }, 50);
        });
    })
    .catch(err => console.error("Error loading utilities:", err));

// Modal
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const modalLink = document.getElementById('modalLink');
const closeModal = document.querySelector('.close');

function openModal(util) {
    modal.classList.add('show');
    modalTitle.textContent = util.name;

    let changelogHTML = '';
    if(util.changelog && util.changelog.length > 0){
        changelogHTML = `<h4>Changelog:</h4><ul>${util.changelog.map(item => `<li>${item}</li>`).join('')}</ul>`;
    }

    modalDesc.innerHTML = `
        <p>${util.description}</p>
        <p><strong>Version:</strong> ${util.version}</p>
        <p><strong>Release Date:</strong> ${util.release_date}</p>
        ${changelogHTML}
    `;
    modalLink.href = util.file;
    document.querySelector('.modal-content').classList.add('active');
}

if(closeModal){
    closeModal.onclick = () => {
        modal.classList.remove('show');
        document.querySelector('.modal-content').classList.remove('active');
    }
}

window.onclick = e => { 
    if(e.target == modal){
        modal.classList.remove('show'); 
        document.querySelector('.modal-content').classList.remove('active'); 
    } 
};

// =====================
// DOWNLOAD COUNTER LOGIC
// =====================
function incrementDownload(utilId) {
    fetch(`/api/utilities/${utilId}/download`, {
        method: 'POST'
    })
    .then(res => res.json())
    .then(data => {
        const el = document.getElementById(`dl-${utilId}`);
        if (el) el.textContent = data.downloads;
    })
    .catch(err => console.error('Failed to increment download count:', err));
}

// =====================
// REMOVED DARK MODE TOGGLE
// =====================
// Per project spec: theme toggle removed, single dark theme enforced.
