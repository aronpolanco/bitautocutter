const upload = document.getElementById('upload');
const detectBtn = document.getElementById('detectBtn');
const cancelBtn = document.getElementById('cancelBtn');
const previewContainer = document.getElementById('previewContainer');
const sourcePreview = document.getElementById('sourcePreview');
const statusMsg = document.getElementById('status');
const paddingInput = document.getElementById('padding');
const downloadSection = document.getElementById('downloadSection');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const baseNameInput = document.getElementById('baseName');

let currentImgSrc = null;

upload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            currentImgSrc = event.target.result;
            sourcePreview.innerHTML = `
                <img src="${currentImgSrc}" id="activeImage" style="display:block; margin:auto; max-height: 300px;">
            `;
            statusMsg.textContent = "Imagen cargada. Pulsa Autodetectar para continuar.";
        };
        reader.readAsDataURL(file);
    }
});

detectBtn.addEventListener('click', () => {
    if (!currentImgSrc) {
        alert("Por favor, sube una imagen primero.");
        return;
    }

    statusMsg.textContent = "⚙️ Procesando imagen...";
    previewContainer.innerHTML = ''; 
    downloadSection.style.display = 'none';

    const img = new Image();
    img.src = currentImgSrc;

    img.onload = () => {
        const procCanvas = document.createElement('canvas');
        const procCtx = procCanvas.getContext('2d');
        procCanvas.width = img.width;
        procCanvas.height = img.height;
        procCtx.drawImage(img, 0, 0);

        let imageData = procCtx.getImageData(0, 0, img.width, img.height);
        let pixels = imageData.data;

        // 👻 MODO FANTASMA: Si la esquina superior izquierda NO es transparente, 
        // asumimos que es un fondo sólido (ej. blanco de Photoroom) y lo matamos en silencio.
        const bgA = pixels[3];
        if (bgA > 10) {
            const bgR = pixels[0];
            const bgG = pixels[1];
            const bgB = pixels[2];
            const tolerance = 5; 

            for (let i = 0; i < pixels.length; i += 4) {
                if (Math.abs(pixels[i] - bgR) <= tolerance && 
                    Math.abs(pixels[i+1] - bgG) <= tolerance && 
                    Math.abs(pixels[i+2] - bgB) <= tolerance) {
                    pixels[i + 3] = 0; // Lo hacemos transparente
                }
            }
            procCtx.putImageData(imageData, 0, 0);
        }

        // Ahora sí, el algoritmo corta buscando la transparencia
        const isBackground = (index) => pixels[index + 3] < 10; 

        const visited = new Uint8Array(img.width * img.height);
        const spriteBlocks = []; 

        for (let y = 0; y < img.height; y++) {
            for (let x = 0; x < img.width; x++) {
                const pixelIndex = (y * img.width + x) * 4;

                if (!visited[y * img.width + x] && !isBackground(pixelIndex)) {
                    const block = { minX: x, minY: y, maxX: x, maxY: y };
                    const queue = [[x, y]];
                    visited[y * img.width + x] = 1;

                    while (queue.length > 0) {
                        const [currX, currY] = queue.shift();

                        block.minX = Math.min(block.minX, currX);
                        block.minY = Math.min(block.minY, currY);
                        block.maxX = Math.max(block.maxX, currX);
                        block.maxY = Math.max(block.maxY, currY);

                        // --- MEJORA V4.0: Rango de salto de 3 píxeles ---
                        const gap = 3; // Distancia para conectar destellos o efectos separados
                        
                        for (let dy = -gap; dy <= gap; dy++) {
                            for (let dx = -gap; dx <= gap; dx++) {
                                const nx = currX + dx;
                                const ny = currY + dy;

                                if (nx >= 0 && nx < img.width && ny >= 0 && ny < img.height) {
                                    const nVisitedIndex = ny * img.width + nx;
                                    const nPixelIndex = nVisitedIndex * 4;

                                    if (!visited[nVisitedIndex] && !isBackground(nPixelIndex)) {
                                        visited[nVisitedIndex] = 1;
                                        queue.push([nx, ny]);
                                    }
                                }
                            }
                        }
                    }
                    spriteBlocks.push(block);
                }
            }
        }

        const padding = parseInt(paddingInput.value) || 0;
        let count = 0;

        spriteBlocks.sort((a, b) => (a.minY - b.minY) || (a.minX - b.minX));

        spriteBlocks.forEach(block => {
            const width = (block.maxX - block.minX + 1) + (padding * 2);
            const height = (block.maxY - block.minY + 1) + (padding * 2);

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(
                procCanvas,
                block.minX, block.minY, block.maxX - block.minX + 1, block.maxY - block.minY + 1,
                padding, padding, block.maxX - block.minX + 1, block.maxY - block.minY + 1
            );

            canvas.classList.add('selected'); 
            canvas.title = "Clic para seleccionar/deseleccionar";
            canvas.addEventListener('click', () => {
                canvas.classList.toggle('selected');
            });
            
            previewContainer.appendChild(canvas);
            count++;
        });

        statusMsg.textContent = `✅ Se detectaron ${count} sprites. ¡Elige cuáles quieres descargar!`;
        downloadSection.style.display = 'block'; 
    };
});

downloadZipBtn.addEventListener('click', async () => {
    const selectedCanvases = document.querySelectorAll('canvas.selected');
    if (selectedCanvases.length === 0) return alert("¡No tienes ningún sprite seleccionado!");

    statusMsg.textContent = "📦 Generando archivo ZIP, por favor espera...";
    const baseName = baseNameInput.value.trim() || "sprite";
    const zip = new JSZip(); 

    const promises = Array.from(selectedCanvases).map((canvas, index) => {
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                zip.file(`${baseName}${index + 1}.png`, blob);
                resolve();
            });
        });
    });

    await Promise.all(promises);

    zip.generateAsync({ type: "blob" }).then((content) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `${baseName}_pack.zip`; 
        link.click();
        statusMsg.textContent = `✅ ZIP descargado exitosamente.`;
    });
});

cancelBtn.addEventListener('click', () => {
    upload.value = ""; 
    sourcePreview.innerHTML = ""; 
    previewContainer.innerHTML = ""; 
    statusMsg.textContent = "Detección cancelada. Sube otra imagen.";
    currentImgSrc = null;
    paddingInput.value = 5;
    downloadSection.style.display = 'none'; 
    baseNameInput.value = 'sprite'; 
});
