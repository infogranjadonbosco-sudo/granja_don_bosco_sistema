import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { supabase } from "../supabase"
import { useCart } from "../context/CartContext"

const images = import.meta.glob("../assets/*.jpg", {
  eager: true,
})

export default function ProductDetail() {
  const { id } = useParams()
  const { addToCart } = useCart()

  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)

  const [option, setOption] = useState("")
  const [unit, setUnit] = useState("1 Libra")
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    const fetchProduct = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single()

      if (!error) setProduct(data)
      setLoading(false)
    }
    fetchProduct()
  }, [id])

  if (loading) return <p>Cargando...</p>
  if (!product || product.deleted) return <p>Producto no encontrado o no disponible</p>

  const image = product.image_url || images[`../assets/${product.name.toLowerCase()}.jpg`]?.default;

  const handleAddToCart = (price, presentation) => {
    addToCart({ ...product, price: price, presentation: presentation });
    alert(`¡Añadido! ${product.name} (${presentation}) se agregó al carrito.`);
  };

  const containerStyle = {
    padding: '40px 20px',
    backgroundColor: '#fdfbc0',
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  };

  const cardStyle = {
    backgroundColor: 'white',
    maxWidth: '900px',
    width: '100%',
    borderRadius: '20px',
    display: 'flex',
    flexWrap: 'wrap',
    overflow: 'hidden',
    boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
    border: '1px solid #ffdae0'
  };

  const imageSectionStyle = {
    flex: '1',
    minWidth: '300px',
    backgroundColor: '#FADADD',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px'
  };

  const infoSectionStyle = {
    flex: '1.2',
    minWidth: '300px',
    padding: '40px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  };

  const selectStyle = {
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    border: '2px solid #FADADD',
    fontSize: '1rem',
    outline: 'none',
    cursor: 'pointer'
  };

  const buttonStyle = {
    backgroundColor: '#1b5e20',
    color: 'white',
    border: 'none',
    padding: '15px 30px',
    borderRadius: '30px',
    fontWeight: 'bold',
    fontSize: '1.1rem',
    cursor: 'pointer',
    transition: 'transform 0.2s',
    marginTop: '10px',
    boxShadow: '0 4px 10px rgba(27, 94, 32, 0.3)'
  };

  /* Esta función arma toda la tarjeta del producto, así no repetimos el mismo HTML en cada categoría */
  const renderProductContent = (selectorLabel, selectorElement, priceDisplay, presentationForCart) => (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={imageSectionStyle}>
          <img src={image} alt={product.name} style={{ width: '100%', maxHeight: '400px', objectFit: 'contain' }} />
        </div>
        <div style={infoSectionStyle}>
          <h1 style={{ color: '#1b5e20', margin: 0, fontSize: '2rem' }}>{product.name}</h1>
          <p style={{ color: '#666', fontSize: '1.1rem' }}>Granja Don Bosco - Calidad Premium</p>

          <div style={{ marginTop: '10px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
              {selectorLabel}
            </label>
            {selectorElement}
          </div>

          <div style={{ marginTop: '20px' }}>
            <span style={{ fontSize: '1rem', color: '#666' }}>Precio total:</span>
            <h2 style={{ color: '#1b5e20', margin: '5px 0', fontSize: '2.5rem' }}>
              ${priceDisplay.toFixed(2)}
            </h2>
          </div>

          <button
            style={{
              ...buttonStyle,
              opacity: (selectorLabel.includes("Seleccionar") && !option) ? 0.5 : 1,
              cursor: (selectorLabel.includes("Seleccionar") && !option) ? 'not-allowed' : 'pointer',
              backgroundColor: (selectorLabel.includes("Seleccionar") && !option) ? '#ccc' : '#1b5e20'
            }}
            disabled={selectorLabel.includes("Seleccionar") && !option}
            onClick={() => handleAddToCart(priceDisplay, presentationForCart)}
            onMouseOver={(e) => {
              if (!(selectorLabel.includes("Seleccionar") && !option)) {
                e.target.style.transform = 'scale(1.02)';
              }
            }}
            onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
          >
            🛒 Agregar al Carrito
          </button>

          <button
            onClick={() => window.history.back()}
            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Volver al catálogo
          </button>
        </div>
      </div>
    </div>
  );

  /* Aquí decidimos qué selector mostrar según el tipo de producto (litros, libras, unidades, etc.) */
  const pName = product.name?.toLowerCase().trim() || "";

  // Vacunas - solo muestran su presentación fija (ml), no se elige peso
  const vaccineNames = ["vacuna triple aviar (50ml)", "vacuna viruela aviar 100 dosis (2ml)", "vacuna rabia paresiante 25 dosis (50ml)", "vacuna triple aviar (25ml)", "vacuna bovisan total 20 dosis (100ml)", "vacuna triple aviar (100ml)"];
  if (vaccineNames.includes(pName)) {
    const presentation = product.name.split('(')[1]?.replace(')', '') || "Única";
    return renderProductContent("Presentación:", <select style={selectStyle} readOnly><option>{presentation}</option></select>, product.price, presentation);
  }

  // Miel - Se vende exclusivamente por botella
  if (pName === "miel") {
    const prices = { "Botella": product.price || 8.00 };
    const sel = "Botella";
    return renderProductContent("Unidad de medida:", (
      <select style={selectStyle} value={sel} readOnly>
        <option value="Botella">Botella</option>
      </select>
    ), prices[sel], sel);
  }

  // Promociones y combos - solo se elige cuántas unidades llevar
  if (pName.includes("promocion") || pName.includes("combo")) {
    const p1 = pName.includes("miel") ? 4 : 5;
    const currentQuantity = quantity;
    const presentation = `${currentQuantity} ${currentQuantity === 1 ? 'unidad' : 'unidades'}`;
    return renderProductContent("Cantidad:", (
      <select style={selectStyle} value={currentQuantity} onChange={(e) => setQuantity(Number(e.target.value))}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => <option key={n} value={n}>{n} {n === 1 ? 'unidad' : 'unidades'}</option>)}
      </select>
    ), product.price * currentQuantity, presentation);
  }

  // Gallinas ponedoras - se venden por unidad
  if (pName === "gallinas rojas(ponedoras)") {
    const currentQuantity = quantity;
    const presentation = `${currentQuantity} ${currentQuantity === 1 ? 'Gallina' : 'Gallinas'}`;
    return renderProductContent("Cantidad:", (
      <select style={selectStyle} value={currentQuantity} onChange={(e) => setQuantity(Number(e.target.value))}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => <option key={n} value={n}>{n} {n === 1 ? 'Gallina' : 'Gallinas'}</option>)}
      </select>
    ), product.price * currentQuantity, presentation);
  }

  // Conejos, Pavos y Patos - Solo Unidad o Mancuerna
  if (pName.includes("pavo") || pName.includes("conejo") || pName.includes("pato")) {
    const isPavo = pName.includes("pavo");
    const isPato = pName.includes("pato");
    const isConejo = pName.includes("conejo");
    
    let labelText = "Unidad:";
    if (isPavo) labelText = "Opción de Pavo:";
    if (isPato) labelText = "Opción de Pato:";

    const unitName = isPavo ? "Pavo" : isPato ? "Pato" : "Conejo/a";
    
    const opts = {
      [`1 ${unitName} (Unidad)`]: { text: "Unidad", extraCharge: 0 },
      "Mancuerna (Pareja)": { text: "Pareja", extraCharge: product.price }
    };
    
    const selKeys = Object.keys(opts);
    const sel = option || selKeys[0];
    const finalPrice = product.price + (opts[sel]?.extraCharge || 0);
    
    return renderProductContent(labelText, (
      <select style={selectStyle} value={sel} onChange={(e) => setOption(e.target.value)}>
        {selKeys.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    ), finalPrice, sel);
  }

  // Carnes y Pollos - se venden por libra, el cliente elige cuántas quiere
  const carnesNames = ["carne roja (libra)", "carne seca (libra)", "carne de cerdo (libra)", "carne de res (libra)"];
  const pollosNames = ["pollo (pechugas) (libra)", "pollo (piernas) (libra)", "pollo entero (6 libras)", "menudo de pollo (libra)"];

  const pNameLower = pName.toLowerCase();
  
  if (carnesNames.includes(pNameLower) || pollosNames.includes(pNameLower)) {
    const isPollo6Lbs = pNameLower === "pollo entero (6 libras)";
    
    if (isPollo6Lbs) {
      const birdOptions = { "1 Unidad (6 lbs)": 1, "2 Unidades (12 lbs)": 2, "3 Unidades (18 lbs)": 3, "4 Unidades (24 lbs)": 4, "5 Unidades (30 lbs)": 5 };
      const sel = unit || "1 Unidad (6 lbs)";
      return renderProductContent("Cantidad (Unidades de Pollo):", (
        <select style={selectStyle} value={sel} onChange={(e) => setUnit(e.target.value)}>
          {Object.keys(birdOptions).map(w => <option key={w} value={w}>{w}</option>)}
        </select>
      ), product.price * (birdOptions[sel] || 1), sel);
    }

    const weightOptions = { "1 Libra(s)": 1, "2 Libra(s)": 2, "3 Libra(s)": 3, "4 Libra(s)": 4, "5 Libra(s)": 5, "10 Libra(s)": 10 };
    const sel = unit || "1 Libra(s)";
    const label = pNameLower.includes("pollo") ? "Cantidad (Libra(s)):" : "Peso (Libra(s)):";

    return renderProductContent(label, (
      <select style={selectStyle} value={sel} onChange={(e) => setUnit(e.target.value)}>
        {Object.keys(weightOptions).map(w => <option key={w} value={w}>{w}</option>)}
      </select>
    ), product.price * (weightOptions[sel] || 1), sel);
  }

  // Lácteos - la leche va en litros/galones, los quesos por presentación
  if (["leche", "requeson", "queso fresco", "queso duro", "crema pura"].includes(pName)) {
    if (pName === "crema pura") {
      const presentation = "Bolsa";
      return renderProductContent("Unidad:", <select style={selectStyle} readOnly><option>{presentation}</option></select>, product.price, presentation);
    }
    let prices = {};
    if (pName === "leche") prices = { "Botella (750ml)": 1.25, "1 Litro": 2, "Medio galón": 2.75, "Un galón (3.78L)": 3.5 };
    else if (pName === "requeson") prices = { "Media Libra(s)": 1.00, "1 Libra(s)": 2.00, "1 bolsa": 0.50 };
    else if (pName === "queso fresco") prices = { "Un cuarto": 0.75, "Medio queso": 1.50, "Queso completo": 3.00, "Queso extragrande (Quesón)": 6.00 };
    else if (pName === "queso duro") prices = { "4 Onzas": 0.90, "Media Libra(s)": 1.80, "1 Libra(s)": 3.60 };
    
    const sel = option || Object.keys(prices)[0];
    const label = pName === "leche" ? "Cantidad / Presentación:" : "Presentación de Lácteos:";
    return renderProductContent(label, (
      <select style={selectStyle} value={sel} onChange={(e) => setOption(e.target.value)}>
        {Object.keys(prices).map(p => <option key={p} value={p}>{p}</option>)}
      </select>
    ), prices[sel] || 0, sel);
  }

  // Huevos - se venden por unidad o por cartón (pequeño, mediano, grande)
  if (pName === "huevos") {
    const eggPrices = { "Unidad": 0.15, "7 Huevos": 1.00, "Medio cartón pequeño": 2, "Medio cartón mediano": 2.5, "Medio cartón grande": 3, "Cartón completo pequeño": 4, "Cartón completo mediano": 5, "Cartón completo grande": 6 };
    return renderProductContent("Seleccionar cantidad:", (
      <select style={selectStyle} value={option} onChange={(e) => setOption(e.target.value)}>
        <option value="">Seleccionar...</option>
        {Object.keys(eggPrices).map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    ), eggPrices[option] || 0, option);
  }

  // Manejo de productos restantes (Miel, Vacunas, Gallinas vivas, Concentrados)
  const pNameLowerFallback = pName.toLowerCase();
  let weightMult = {};
  let label = "Cantidad:";
  
  if (pNameLowerFallback.includes("concentrado") || pNameLowerFallback.includes("alimento")) {
    label = "Cantidad (Sacos/Peso):";
    weightMult = { "1 Quintal (100 Libra(s))": 1, "Medio Quintal (50 Libra(s))": 0.5, "1 Arroba (25 Libra(s))": 0.25, "5 Libra(s)": 0.05, "1 Libra(s)": 0.01 };
  } else if (pNameLowerFallback.includes("miel")) {
    label = "Cantidad (Botellas):";
    weightMult = { "1 Botella": 1, "2 Botellas": 2, "3 Botellas": 3, "1/2 Galón": 2.5, "1 Galón": 5 };
  } else {
    let baseUnit = product?.unidad_medida || "Unidad";
    let pluralUnit = "";
    
    if (baseUnit.toLowerCase() === "par") pluralUnit = "Pares";
    else if (baseUnit.toLowerCase() === "libra" || baseUnit.toLowerCase() === "libras") {
      baseUnit = baseUnit.toLowerCase() === "libra" ? "Libra" : "Libras";
      pluralUnit = "Libras";
    }
    else if (baseUnit.toLowerCase() === "bolsa") pluralUnit = "Bolsas";
    else if (baseUnit.toLowerCase() === "un cuarto") {
      baseUnit = "Cuarto";
      pluralUnit = "Cuartos";
    }
    else pluralUnit = `${baseUnit}s`;
    
    weightMult = { 
      [`1 ${baseUnit}`]: 1, 
      [`2 ${pluralUnit}`]: 2, 
      [`3 ${pluralUnit}`]: 3, 
      [`4 ${pluralUnit}`]: 4, 
      [`5 ${pluralUnit}`]: 5, 
      [`10 ${pluralUnit}`]: 10 
    };
  }
  
  const selKeys = Object.keys(weightMult);
  const sel = unit || selKeys[0];
  
  return renderProductContent(label, (
    <select style={selectStyle} value={sel} onChange={(e) => setUnit(e.target.value)}>
      {selKeys.map(w => <option key={w} value={w}>{w}</option>)}
    </select>
  ), product.price * (weightMult[sel] || 1), sel);
}