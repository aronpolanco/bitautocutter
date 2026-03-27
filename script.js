const upload = document.getElementById('upload');
const detectBtn = document.getElementById('detectBtn');
const cancelBtn = document.getElementById('cancelBtn');
const previewContainer = document.getElementById('previewContainer');
const statusMsg = document.getElementById('status');
const paddingInput = document.getElementById('padding');
const downloadSection = document.getElementById('downloadSection');
const downloadZipBtn = document.getElementById('downloadZipBtn');

let currentImgSrc = null;

upload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            currentImgSrc = event.target.result;
            statusMsg.textContent = "Imagen lista. Haz clic en Autodetectar.";
        };
        reader.readAsDataURL(file);
    }
});

detectBtn.addEventListener('click', () => {
    if (!currentImgSrc) return alert("Sube una imagen.");

    statusMsg.textContent = "✂️ Cortando...";
    previewContainer.innerHTML = '';

    const img = new Image();
    img.src = currentImgSrc;

    img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width; canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const pixels = imageData.data;

        // Borrar fondo sólido si existe (Modo Fantasma)
        if (pixels[3] > 10) {
            const r = pixels[0], g = pixels[1], b = pixels[2];
            for (let i = 0; i < pixels.length; i += 4) {
                if (Math.abs(pixels[i]-r)<5 && Math.abs(pixels[i+1]-g)<5 && Math.abs(pixels[i+2]-b)<5) pixels[i+3]=0;
            }
        }

        const visited = new Uint8Array(img.width * img.height);
        const blocks = [];

        for (let y = 0; y < img.height; y++) {
            for (let x = 0; x < img.width; x++) {
                const idx = (y * img.width + x) * 4;
                if (!visited[y * img.width + x] && pixels[idx + 3] > 10) {
                    const block = { minX: x, minY: y, maxX: x, maxY: y };
                    const queue = [[x, y]];
                    visited[y * img.width + x] = 1;

                    while (queue.length > 0) {
                        const [cx, cy] = queue.shift();
                        block.minX = Math.min(block.minX, cx);
                        block.minY = Math.min(block.minY, cy);
                        block.maxX = Math.max(block.maxX, cx);
                        block.maxY = Math.max(block.maxY, cy);

                        // Rango de búsqueda: 1 píxel (Equilibrado para efectos)
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                const nx = cx + dx, ny = cy + dy;
                                if (nx >= 0 && nx < img.width && ny >= 0 && ny < img.height) {
                                    const nIdx = ny * img.width + nx;
                                    if (!visited[nIdx] && pixels[nIdx * 4 + 3] > 10) {
                                        visited[nIdx] = 1;
                                        queue.push([nx, ny]);
                                    }
                                }
                            }
                        }
                    }
                    // Solo agregar si el bloque tiene un tamaño mínimo (evitar basura)
                    if ((block.maxX - block.minX) > 1) blocks.push(block);
                }
            }
        }

        const pad = parseInt(paddingInput.value) || 0;
        blocks.sort((a,b) => a.minY - b.minY || a.minX - b.minX).forEach(b => {
            const w = (b.maxX - b.minX + 1) + (pad * 2);
            const h = (b.maxY - b.minY + 1) + (pad * 2);
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            const cx = c.getContext('2d');
            cx.drawImage(canvas, b.minX, b.minY, b.maxX-b.minX+1, b.maxY-b.minY+1, pad, pad, b.maxX-b.minX+1, b.maxY-b.minY+1);
            c.classList.add('selected');
            c.onclick = () => c.classList.toggle('selected');
            previewContainer.appendChild(c);
        });

        statusMsg.textContent = `✅ Detectados: ${blocks.length}`;
        downloadSection.style.display = 'block';
    };
});

downloadZipBtn.onclick = async () => {
    const selected = document.querySelectorAll('canvas.selected');
    if (!selected.length) return;
    const zip = new JSZip();
    const name = document.getElementById('baseName').value || "sprite";
    
    for (let i = 0; i < selected.length; i++) {
        const blob = await new Promise(res => selected[i].toBlob(res));
        zip.file(`${name}_${i+1}.png`, blob);
    }

    zip.generateAsync({type:"blob"}).then(content => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(content);
        a.download = `${name}_pack.zip`;
        a.click();
    });
};

cancelBtn.onclick = () => location.reload();
