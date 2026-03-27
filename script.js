// ==========================================
//  SELECTORES DEL DOM (BOTONES E INPUTS)
// ==========================================
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

// Variable global para guardar la imagen original
let currentImgSrc = null;

// ==========================================
//  LÓGICA 1.0: PREVISUALIZAR IMAGEN AL SUBIR
// ==========================================
upload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            currentImgSrc = event.target.result;
            sourcePreview.innerHTML = `
                <p>Imagen original:</p>
                <img src="${currentImgSrc}" id="activeImage" style="display:block; margin:auto;">
            `;
            statusMsg.textContent = "Imagen cargada. Pulsa ✨ Autodetectar para continuar.";
        };
        reader.readAsDataURL(file);
    }
});

// ==========================================
//  LÓGICA 2.0 PRO: AUTODETECCIÓN Y CORTE CON REMOVER FONDO AVANZADO
// ==========================================
detectBtn.addEventListener('click', () => {
    if (!currentImgSrc) {
        alert("Por favor, sube una imagen primero.");
        return;
    }

    statusMsg.textContent = "⚙️ Procesando imagen...";
    previewContainer.innerHTML = ''; // Limpiar cortes anteriores
    downloadSection.style.display = 'none'; // Ocultar descargas anteriores

    const img = new Image();
    img.src = currentImgSrc;

    // --- AQUÍ EMPIEZA EL BLOQUE QUE REVISAMOS ANTES ---
    img.onload = () => {
        // A. Crear un canvas para procesar datos de píxeles
        const procCanvas = document.createElement('canvas');
        const procCtx = procCanvas.getContext('2d');
        procCanvas.width = img.width;
        procCanvas.height = img.height;
        procCtx.drawImage(img, 0, 0);

        // B. Obtener los datos de los píxeles (RGBA)
        let imageData = procCtx.getImageData(0, 0, img.width, img.height);
        let pixels = imageData.data;

        // C. NUEVA LÓGICA V2.0 PRO: Remover fondos sólidos y de cuadritos (dos colores)
        const removeBg = document.getElementById('removeBg');
        if (removeBg && removeBg.checked) {
            // Leer el primer color de fondo (esquina superior izquierda)
            const bgR1 = pixels[0];
            const bgG1 = pixels[1];
            const bgB1 = pixels[2];
            const bgA1 = pixels[3];

            let bgR2 = bgR1, bgG2 = bgG1, bgB2 = bgB1, bgA2 = bgA1;
            let foundSecondColor = false;
            const tolerance = 5; // Tolerancia para variaciones leves (ej. JPG artifacts)

            // Si el primer color no es ya transparente, buscamos un segundo color (para cuadritos)
            if (bgA1 > 10) {
                // Escaneamos la primera fila para detectar si hay patrón de cuadritos
                for (let x = 0; x < img.width; x++) {
                    const pixelIndex = x * 4;
                    const r = pixels[pixelIndex];
                    const g = pixels[pixelIndex + 1];
                    const b = pixels[pixelIndex + 2];
                    const a = pixels[pixelIndex + 3];

                    // Si encontramos un color diferente al primero en la primera fila, lo marcamos como color2
                    if (Math.abs(r - bgR1) > tolerance ||
                        Math.abs(g - bgG1) > tolerance ||
                        Math.abs(b - bgB1) > tolerance) {
                        bgR2 = r; bgG2 = g; bgB2 = b; bgA2 = a;
                        foundSecondColor = true;
                        break; // Se asume que el patrón de cuadritos tiene solo 2 colores principales
                    }
                }
            }

            // Si el primer color no es ya transparente, borramos ambos colores detectados
            if (bgA1 > 10) {
                for (let i = 0; i < pixels.length; i += 4) {
                    const r = pixels[i];
                    const g = pixels[i + 1];
                    const b = pixels[i + 2];
                    const a = pixels[i + 3];

                    // Comprobar si el píxel es casi igual al primer o al segundo color (si se detectó)
                    const isColor1 = (Math.abs(r - bgR1) <= tolerance && Math.abs(g - bgG1) <= tolerance && Math.abs(b - bgB1) <= tolerance);
                    const isColor2 = foundSecondColor && (Math.abs(r - bgR2) <= tolerance && Math.abs(g - bgG2) <= tolerance && Math.abs(b - bgB2) <= tolerance);

                    if (isColor1 || isColor2) {
                        pixels[i + 3] = 0; // Alpha a 0 (Transparente)
                    }
                }
                // Aplicar los cambios al canvas procesado
                procCtx.putImageData(imageData, 0, 0);
            }
        }
        
        // D. El algoritmo de búsqueda ahora solo busca transparencia pura, sobre los datos ya modificados
        const isBackground = (index) => pixels[index + 3] < 10; 

        // Algoritmo BFS para agrupar píxeles adyacentes (el "cerebro" del recorte)
        const visited = new Uint8Array(img.width * img.height);
        const spriteBlocks = []; 

        for (let y = 0; y < img.height; y++) {
            for (let x = 0; x < img.width; x++) {
                const pixelIndex = (y * img.width + x) * 4;

                if (!visited[y * img.width + x] && !isBackground(pixelIndex)) {
                    // Nuevo sprite detectado
                    const block = { minX: x, minY: y, maxX: x, maxY: y };
                    const queue = [[x, y]];
                    visited[y * img.width + x] = 1;

                    while (queue.length > 0) {
                        const [currX, currY] = queue.shift();

                        block.minX = Math.min(block.minX, currX);
                        block.minY = Math.min(block.minY, currY);
                        block.maxX = Math.max(block.maxX, currX);
                        block.maxY = Math.max(block.maxY, currY);

                        // Comprobar vecinos (4 direcciones)
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

        // Ordenar los sprites de izquierda a derecha, arriba a abajo
        spriteBlocks.sort((a, b) => (a.minY - b.minY) || (a.minX - b.minX));

        // E. Dibujar los sprites detectados en canvas individuales para previsualización
        spriteBlocks.forEach(block => {
            const width = (block.maxX - block.minX + 1) + (padding * 2);
            const height = (block.maxY - block.minY + 1) + (padding * 2);

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            // !!! IMPORTANTE !!!: Dibujamos desde procCanvas, que tiene los fondos ya borrados
            ctx.drawImage(
                procCanvas,
                block.minX, block.minY, block.maxX - block.minX + 1, block.maxY - block.minY + 1,
                padding, padding, block.maxX - block.minX + 1, block.maxY - block.minY + 1
            );

            // Hacer interactiva la previsualización (clic para seleccionar/deseleccionar)
            canvas.classList.add('selected'); // Todos seleccionados por defecto
            canvas.title = "Clic para seleccionar/deseleccionar";
            canvas.addEventListener('click', () => {
                canvas.classList.toggle('selected');
            });
            
            previewContainer.appendChild(canvas);
            count++;
        });

        statusMsg.textContent = ` ¡Listo! Se detectaron ${count} sprites automáticamente. Elige cuáles quieres descargar.`;
        downloadSection.style.display = 'block'; // Mostrar opciones de descarga
    };
    // --- AQUÍ TERMINA EL BLOQUE QUE REVISAMOS ANTES ---
});

// ==========================================
// 📦 LÓGICA 1.0: DESCARGAR SELECCIÓN EN ZIP (REQUIERE JSZIP)
// ==========================================
downloadZipBtn.addEventListener('click', async () => {
    // Buscar todos los canvas que tengan la clase 'selected'
    const selectedCanvases = document.querySelectorAll('canvas.selected');
    
    if (selectedCanvases.length === 0) {
        alert("¡No tienes ningún sprite seleccionado! Haz clic en los sprites para elegirlos.");
        return;
    }

    statusMsg.textContent = " Generando archivo ZIP, por favor espera...";
    
    const baseName = baseNameInput.value.trim() || "sprite";
    const zip = new JSZip(); // Iniciamos la librería ZIP

    // Convertir cada canvas en un archivo de imagen asíncronamente
    const promises = Array.from(selectedCanvases).map((canvas, index) => {
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                // Nombramos el archivo secuencialmente: baseName + numero (ej. car1.png)
                zip.file(`${baseName}${index + 1}.png`, blob);
                resolve();
            });
        });
    });

    // Esperamos a que todos los canvas se conviertan a blobs de imagen
    await Promise.all(promises);

    // Generar el ZIP y forzar la descarga en el navegador
    zip.generateAsync({ type: "blob" }).then((content) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `${baseName}_pack.zip`; // Nombre del zip final
        link.click();
        
        statusMsg.textContent = ` ZIP descargado exitosamente con ${selectedCanvases.length} imágenes.`;
    });
});

// ==========================================
// LÓGICA 1.0: FUNCIÓN DE REINICIO (CANCELAR)
// ==========================================
cancelBtn.addEventListener('click', () => {
    upload.value = ""; // Reset input
    sourcePreview.innerHTML = ""; // Quitar imagen original
    previewContainer.innerHTML = ""; // Quitar cortes
    statusMsg.textContent = "Detección cancelada. Sube otra imagen.";
    currentImgSrc = null;
    paddingInput.value = 5;
    downloadSection.style.display = 'none'; // Ocultar descargas
    baseNameInput.value = 'sprite'; // Reset nombre base
});
