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

// NUEVO: Función Asíncrona para esperar a la IA
detectBtn.addEventListener('click', async () => {
    if (!currentImgSrc) {
        alert("Por favor, sube una imagen primero.");
        return;
    }

    const useAI = document.getElementById('removeBg').checked;
    
    // Bloquear el botón y mostrar mensaje de carga
    detectBtn.disabled = true;
    previewContainer.innerHTML = ''; 
    downloadSection.style.display = 'none';

    let finalImageSrc = currentImgSrc; // Por defecto usamos la original

    try {
        if (useAI) {
            statusMsg.textContent = "🤖 IA procesando... (Esto puede tardar varios segundos, no cierres la página).";
            
            // Configuración de la IA para cargar desde CDN y usar modelo rápido (small)
            const config = {
                publicPath: "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.4.3/dist/assets/",
                model: "medium"
            };

            // Ejecutamos la magia de la IA
            const blob = await imglyRemoveBackground(currentImgSrc, config);
            
            // Convertimos el resultado en una imagen utilizable por nuestro canvas
            finalImageSrc = URL.createObjectURL(blob);
        } else {
            statusMsg.textContent = "⚙️ Procesando imagen...";
        }

        // Una vez que tenemos la imagen final (limpia o normal), empezamos a cortar
        const img = new Image();
        img.src = finalImageSrc;

        img.onload = () => {
            const procCanvas = document.createElement('canvas');
            const procCtx = procCanvas.getContext('2d');
            procCanvas.width = img.width;
            procCanvas.height = img.height;
            procCtx.drawImage(img, 0, 0);

            const imageData = procCtx.getImageData(0, 0, img.width, img.height);
            const pixels = imageData.data;

            const isBackground = (index) => pixels[index + 3] < 10; 

            const visited = new Uint8Array(img.width * img.height);
            const spriteBlocks = []; 

            // Algoritmo BFS
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
            detectBtn.disabled = false; // Reactivamos el botón
        };

    } catch (error) {
        console.error("Error en el procesamiento de IA:", error);
        statusMsg.textContent = "❌ Error en la IA. Intenta desmarcar la casilla de Borrar Fondo.";
        detectBtn.disabled = false; // Reactivamos el botón por si hay error
    }
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
    detectBtn.disabled = false; // Asegurarnos de que el botón no se quede pegado
});
