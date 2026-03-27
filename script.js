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

        // LÓGICA V2.0 PRO: Remover fondos sólidos (Color Keying)
        const removeBg = document.getElementById('removeBg');
        if (removeBg && removeBg.checked) {
            const bgR1 = pixels[0];
            const bgG1 = pixels[1];
            const bgB1 = pixels[2];
            const bgA1 = pixels[3];

            let bgR2 = bgR1, bgG2 = bgG1, bgB2 = bgB1, bgA2 = bgA1;
            let foundSecondColor = false;
            const tolerance = 5; 

            if (bgA1 > 10) {
                for (let x = 0; x < img.width; x++) {
                    const pixelIndex = x * 4;
                    const r = pixels[pixelIndex];
                    const g = pixels[pixelIndex + 1];
                    const b = pixels[pixelIndex + 2];
                    const a = pixels[pixelIndex + 3];

                    if (Math.abs(r - bgR1) > tolerance ||
                        Math.abs(g - bgG1) > tolerance ||
                        Math.abs(b - bgB1) > tolerance) {
                        bgR2 = r; bgG2 = g; bgB2 = b; bgA2 = a;
                        foundSecondColor = true;
                        break; 
                    }
                }
            }

            if (bgA1 > 10) {
                for (let i = 0; i < pixels.length; i += 4) {
                    const r = pixels[i];
                    const g = pixels[i + 1];
                    const b = pixels[i + 2];

                    const isColor1 = (Math.abs(r - bgR1) <= tolerance && Math.abs(g - bgG1) <= tolerance && Math.abs(b - bgB1) <= tolerance);
                    const isColor2 = foundSecondColor && (Math.abs(r - bgR2) <= tolerance && Math.abs(g - bgG2) <= tolerance && Math.abs(b - bgB2) <= tolerance);

                    if (isColor1 || isColor2) {
                        pixels[i + 3] = 0; 
                    }
                }
                procCtx.putImageData(imageData, 0, 0);
            }
        }
        
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

                        const neighbors = [
                            [currX + 1, currY], [currX - 1, currY],
                            [currX, currY + 1], [currX, currY - 1]
                        ];

                        for (const [nx, ny] of neighbors) {
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
