const upload = document.getElementById('upload');
const detectBtn = document.getElementById('detectBtn');
const cancelBtn = document.getElementById('cancelBtn');
const previewContainer = document.getElementById('previewContainer');
const sourcePreview = document.getElementById('sourcePreview');
const statusMsg = document.getElementById('status');
const paddingInput = document.getElementById('padding');

// Nuevos elementos
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
                <img src="${currentImgSrc}" id="activeImage" style="display:block; margin:auto;">
            `;
            statusMsg.textContent = "Imagen cargada. Pulsa ✨ Autodetectar para continuar.";
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
    downloadSection.style.display = 'none'; // Ocultar mientras carga

    const img = new Image();
    img.src = currentImgSrc;

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

        // Ordenar los sprites de izquierda a derecha, arriba a abajo (opcional pero recomendado)
        spriteBlocks.sort((a, b) => (a.minY - b.minY) || (a.minX - b.minX));

        spriteBlocks.forEach(block => {
            const width = (block.maxX - block.minX + 1) + (padding * 2);
            const height = (block.maxY - block.minY + 1) + (padding * 2);

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(
                img,
                block.minX, block.minY, block.maxX - block.minX + 1, block.maxY - block.minY + 1,
                padding, padding, block.maxX - block.minX + 1, block.maxY - block.minY + 1
            );

            // NUEVO: Lógica de selección
            canvas.classList.add('selected'); // Todos seleccionados por defecto
            canvas.title = "Clic para seleccionar/deseleccionar";
            canvas.addEventListener('click', () => {
                canvas.classList.toggle('selected');
            });
            
            previewContainer.appendChild(canvas);
            count++;
        });

        statusMsg.textContent = `✅ Se detectaron ${count} sprites. ¡Elige cuáles quieres descargar!`;
        downloadSection.style.display = 'block'; // Mostrar opciones de descarga
    };
});

// NUEVO: Lógica para descargar el ZIP
downloadZipBtn.addEventListener('click', async () => {
    // Buscar todos los canvas que tengan la clase 'selected'
    const selectedCanvases = document.querySelectorAll('canvas.selected');
    
    if (selectedCanvases.length === 0) {
        alert("¡No tienes ningún sprite seleccionado!");
        return;
    }

    statusMsg.textContent = "📦 Generando archivo ZIP, por favor espera...";
    
    const baseName = baseNameInput.value.trim() || "sprite";
    const zip = new JSZip(); // Iniciamos la librería ZIP

    // Convertir cada canvas en un archivo de imagen asíncronamente
    const promises = Array.from(selectedCanvases).map((canvas, index) => {
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                // Nombramos el archivo: baseName + numero (ej. car1.png)
                zip.file(`${baseName}${index + 1}.png`, blob);
                resolve();
            });
        });
    });

    // Esperamos a que todos los canvas se conviertan a imágenes
    await Promise.all(promises);

    // Generar y descargar el ZIP
    zip.generateAsync({ type: "blob" }).then((content) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `${baseName}_pack.zip`; // Nombre del zip final
        link.click();
        
        statusMsg.textContent = `✅ ZIP descargado exitosamente con ${selectedCanvases.length} imágenes.`;
    });
});

cancelBtn.addEventListener('click', () => {
    upload.value = ""; 
    sourcePreview.innerHTML = ""; 
    previewContainer.innerHTML = ""; 
    statusMsg.textContent = "Detección cancelada. Sube otra imagen.";
    currentImgSrc = null;
    paddingInput.value = 5;
    downloadSection.style.display = 'none'; // Ocultar descargas
});