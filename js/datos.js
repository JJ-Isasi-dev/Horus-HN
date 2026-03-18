
async function cargarColonias() {
  try {
    const respuesta = await fetch('data/colonias.json');
    const datos = await respuesta.json();
    return datos.colonias;
  } catch (error) {
    console.error('Error al cargar colonias:', error);
    return [];
  }
}

function filtrarPorTipo(colonias, tipo) {
  return colonias.filter(c => c.tipo === tipo);
}

function contarPorTipo(colonias) {
  const conteo = {};
  Object.keys(COLORES).forEach(tipo => {
    conteo[tipo] = colonias.filter(c => c.tipo === tipo).length;
  });
  return conteo;
}