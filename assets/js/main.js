let datosTienda = {};
let categoriaActiva = 'comida';
let carrito = {};
let tipoEntregaSeleccionado = ''; // Almacena 'domicilio' o 'local'

// SOLUCCIÓN COMANDE EN TIEMPO REAL: Agregamos ?v= + Date.now() para romper la caché del navegador
document.addEventListener('DOMContentLoaded', () => {
  fetch('data/web_info.json?v=' + Date.now())
    .then(response => {
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status} - No se pudo leer el archivo JSON`);
      }
      return response.json();
    })
    .then(data => {
      datosTienda = data;
      inicializarInterfaz();
    })
    .catch(error => {
      console.error('Error detallado:', error);
      document.getElementById('tienda-nombre').innerText = "Error de Datos";
      document.getElementById('tienda-eslogan').innerText = "El archivo JSON no se encuentra o tiene un error de formato.";
    });
});

function inicializarInterfaz() {
  const config = datosTienda.configuracion;
  
  document.getElementById('tienda-nombre').innerText = config.nombre_tienda;
  document.getElementById('tienda-eslogan').innerText = config.eslogan;
  
  document.querySelector('.header-overlay').style.backgroundColor = hexToRgba(config.color_principal, 0.35);
  document.querySelector('.barra-compra').style.backgroundColor = config.color_principal;

  renderizarCategorias();
  renderizarPlatillos();

  document.getElementById('btn-ordenar').addEventListener('click', enviarComandaWhatsApp);
}

function hexToRgba(hex, alpha) {
  let r = parseInt(hex.slice(1, 3), 16),
      g = parseInt(hex.slice(3, 5), 16),
      b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Controla de forma excluyente qué campo de ubicación se muestra en el encabezado
function alternarDestinoEntrega(valor) {
  tipoEntregaSeleccionado = valor;
  const campoDomicilio = document.getElementById('campo-domicilio');
  const campoLocal = document.getElementById('campo-local');

  if (valor === 'domicilio') {
    campoDomicilio.style.display = 'block';
    campoLocal.style.display = 'none';
    document.getElementById('input-mesa').value = ''; // Limpia el otro campo
  } else if (valor === 'local') {
    campoDomicilio.style.display = 'none';
    campoLocal.style.display = 'block';
    document.getElementById('input-direccion').value = ''; // Limpia el otro campo
  }
}

function renderizarCategorias() {
  const contenedorNav = document.getElementById('contenedor-categorias');
  contenedorNav.innerHTML = '';

  datosTienda.categorias.forEach(cat => {
    const boton = document.createElement('button');
    boton.className = `btn-categoria ${cat.id === categoriaActiva ? 'activo' : ''}`;
    boton.innerText = cat.nombre;
    boton.onclick = () => cambiarCategoria(cat.id);
    contenedorNav.appendChild(boton);
  });
}

function cambiarCategoria(idCategoria) {
  categoriaActiva = idCategoria;
  renderizarCategorias();
  renderizarPlatillos();
}

function renderizarPlatillos() {
  const contenedorGrid = document.getElementById('contenedor-platillos');
  contenedorGrid.innerHTML = '';

  if (categoriaActiva === 'notas') {
    contenedorGrid.innerHTML = `
      <div class="platillo-card" style="flex-direction: column; align-items: flex-start; width: 100%;">
        <h3 style="margin-bottom: 8px;">📝 Sugerencias o Notas del Pedido</h3>
        <p style="font-size: 0.9rem; color: #666; margin-bottom: 12px;">Escribe aquí cualquier indicación general para el repartidor:</p>
        <textarea id="nota-general" placeholder="Ej: Llevar cambio de $20.000, tocar el timbre fuerte..." style="width: 100%; height: 100px; padding: 10px; border-radius: 8px; border: 1px solid #ccc; resize: none;"></textarea>
      </div>
    `;
    return;
  }

  const filtrados = datosTienda.platillos.filter(p => p.categoria === categoriaActiva);

  filtrados.forEach(prod => {
    const yaElegido = carrito[prod.id] !== undefined;
    const cant = yaElegido ? carrito[prod.id].cantidad : 1;
    const notaTexto = yaElegido ? carrito[prod.id].notaEspecifica : '';

    const card = document.createElement('div');
    card.className = 'platillo-card';
    card.style.flexDirection = 'column'; 
    card.style.alignItems = 'stretch';

    card.innerHTML = `
      <div style="display: flex; gap: 15px; align-items: center; width: 100%;">
        <img src="${prod.imagen}" alt="${prod.titulo}" class="platillo-img" onerror="this.src='https://picsum.photos'">
        <div class="platillo-info" style="display: flex; flex-direction: column;">
          <h3 style="margin: 0;">${prod.titulo}</h3>
          <!-- Enlace interactivo para desplegar ventana flotante de ingredientes -->
          <button class="btn-ver-ingredientes" onclick="abrirModalIngredientes(${prod.id})">📋 Ver ingredientes</button>
          <p class="platillo-precio" style="margin: 4px 0 6px 0;">$${prod.precio.toLocaleString()}</p>
          <div class="platillo-meta">
            <span>Cant:</span>
            <input type="number" min="1" value="${cant}" id="cant-${prod.id}" onchange="actualizarCantidad(${prod.id})">
          </div>
        </div>
        <input type="checkbox" class="platillo-check" ${yaElegido ? 'checked' : ''} onchange="alternarProducto(${prod.id}, this.checked)">
      </div>
      
      <div id="wrapper-nota-${prod.id}" style="display: ${yaElegido ? 'block' : 'none'}; margin-top: 12px;">
        <textarea id="nota-prod-${prod.id}" placeholder="¿Alguna modificación? (Ej: Sin cebolla, salsa extra...)" 
          style="width: 100%; height: 45px; padding: 8px; border-radius: 6px; border: 1px solid #ccc; resize: none; font-size: 0.85rem;"
          onchange="actualizarNotaProducto(${prod.id})">${notaTexto}</textarea>
      </div>
    `;
    contenedorGrid.appendChild(card);
  });
}

// Funciones para el control de la Ventana Flotante de Ingredientes en el Cliente
function abrirModalIngredientes(id) {
  const prod = datosTienda.platillos.find(p => p.id === id);
  if (prod) {
    document.getElementById('modal-ingredientes-titulo').innerText = `📋 Ingredientes: ${prod.titulo}`;
    document.getElementById('modal-ingredientes-cuerpo').innerText = prod.descripcion || "Ingredientes no especificados.";
    document.getElementById('modalIngredientes').classList.add('mostrar-modal');
  }
}

function cerrarModalIngredientes() {
  document.getElementById('modalIngredientes').classList.remove('mostrar-modal');
}

function alternarProducto(id, estaMarcado) {
  const wrapperNota = document.getElementById(`wrapper-nota-${id}`);
  if (estaMarcado) {
    const prod = datosTienda.platillos.find(p => p.id === id);
    const cantInput = parseInt(document.getElementById(`cant-${id}`).value) || 1;
    const notaInput = document.getElementById(`nota-prod-${id}`).value;
    
    carrito[id] = { ...prod, cantidad: cantInput, notaEspecifica: notaInput };
    if (wrapperNota) wrapperNota.style.display = 'block'; 
  } else {
    delete carrito[id];
    if (wrapperNota) {
      wrapperNota.style.display = 'none'; 
      document.getElementById(`nota-prod-${id}`).value = ''; 
    }
  }
  recalcularTotal();
}

function actualizarNotaProducto(id) {
  const notaInput = document.getElementById(`nota-prod-${id}`).value;
  if (carrito[id]) {
    carrito[id].notaEspecifica = notaInput;
  }
}

function actualizarCantidad(id) {
  const cantInput = parseInt(document.getElementById(`cant-${id}`).value) || 1;
  if (carrito[id]) {
    carrito[id].cantidad = cantInput;
    recalcularTotal();
  }
}

function recalcularTotal() {
  let acumulado = 0;
  Object.values(carrito).forEach(item => {
    acumulado += item.precio * item.cantidad;
  });
  document.getElementById('total-precio').innerText = `$${acumulado.toLocaleString()}`;
}

function enviarComandaWhatsApp() {
  if (!tipoEntregaSeleccionado) {
    alert('Por favor, selecciona si tu pedido es a Domicilio o en el Local en la parte superior.');
    return;
  }

  let infoUbicacion = '';
  if (tipoEntregaSeleccionado === 'domicilio') {
    const dir = document.getElementById('input-direccion').value.trim();
    if (!dir) { 
      alert('Por favor, escribe tu dirección de entrega.');
      return;
    }
    infoUbicacion = dir;
  } else if (tipoEntregaSeleccionado === 'local') {
    const mesa = document.getElementById('input-mesa').value.trim();
    if (!mesa) {
      alert('Por favor, escribe el número de mesa.');
      return;
    }
    infoUbicacion = "Mesa " + mesa;
  }

  // Generar código único aleatorio de 8 dígitos
  const codigoOrden = Math.floor(10000000 + Math.random() * 90000000);
  
  if (Object.keys(carrito).length === 0) {
    alert('El carrito está vacío. Agrega al menos un producto.');
    return;
  }

  // Estructurar comanda limpia para WhatsApp con negritas y viñetas
  let textoComanda = `🛍️ *NUEVA ORDEN (#${codigoOrden})*\n`;
  textoComanda += `📍 *Ubicación:* ${infoUbicacion}\n\n`;
  textoComanda += `📋 *Detalle del Pedido:*\n`;

  Object.values(carrito).forEach(item => {
    textoComanda += `• ${item.cantidad}x ${item.titulo} ($${(item.precio * item.cantidad).toLocaleString()})\n`;
    if (item.notaEspecifica && item.notaEspecifica.trim() !== '') {
      textoComanda += `  └ _Nota: ${item.notaEspecifica.trim()}_\n`;
    }
  });

  const notaGen = document.getElementById('nota-general');
  if (notaGen && notaGen.value.trim() !== '') {
    textoComanda += `\n📝 *Notas Generales:* ${notaGen.value.trim()}\n`;
  }

  let totalAcumulado = 0;
  Object.values(carrito).forEach(item => { totalAcumulado += item.precio * item.cantidad; });
  
  textoComanda += `\n💰 *Total a Pagar:* $${totalAcumulado.toLocaleString()}`;

  const numDestino = datosTienda.configuracion.whatsapp_destino;
  const urlWhatsApp = `https://wa.me{numDestino}?text=${encodeURIComponent(textoComanda)}`;
  
  window.open(urlWhatsApp, '_blank');
}
