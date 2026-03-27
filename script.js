img.onload = () => {
        const procCanvas = document.createElement('canvas');
        const procCtx = procCanvas.getContext('2d');
        procCanvas.width = img.width;
        procCanvas.height = img.height;
        procCtx.drawImage(img, 0, 0);

        const imageData = procCtx.getImageData(0, 0, img.width, img.height);
        const pixels = imageData.data;

        // NUEVA LÓGICA V2.0: Remover fondo sólido
        const removeBg = document.getElementById('removeBg');
        if (removeBg && removeBg.checked) {
            // Tomar el color del píxel (0,0) como referencia de fondo
            const bgR = pixels[0];
            const bgG = pixels[1];
            const bgB = pixels[2];
            const bgA = pixels[3];

            // Si el fondo no es ya transparente, lo borramos
            if (bgA > 10) {
                const tolerance = 5; // Tolerancia para pequeñas variaciones de color (ej. JPG artifacts)
                for (let i = 0; i < pixels.length; i += 4) {
                    const r = pixels[i];
                    const g = pixels[i + 1];
                    const b = pixels[i + 2];
                    
                    // Si el color del píxel es casi igual al color de fondo, lo hacemos transparente
                    if (Math.abs(r - bgR) <= tolerance && 
                        Math.abs(g - bgG) <= tolerance && 
                        Math.abs(b - bgB) <= tolerance) {
                        pixels[i + 3] = 0; // Alpha a 0 (Transparente)
                    }
                }
                // Aplicar los cambios al canvas procesado
                procCtx.putImageData(imageData, 0, 0);
            }
        }

        // El algoritmo ahora solo busca transparencia pura
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

            // CAMBIO CLAVE: Ahora dibujamos desde 'procCanvas' en lugar de 'img'
            // Así los sprites conservan la transparencia que acabamos de generar
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
