import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useCart } from "../context/CartContext";
import { BrandLogo } from "../components/BrandLogo";

const images = import.meta.glob("../assets/*.{png,jpg,jpeg,PNG,JPG,JPEG}", { eager: true });

const CATEGORY_ORDER = [
    "ANIMALES",
    "CARNES",
    "LÁCTEOS",
    "CONCENTRADOS",
    "VACUNAS Y MEDICINA",
    "OTROS ALIMENTOS",
    "OTROS PRODUCTOS"
];

function PublicProductCard({ product, navigate }) {
    const [isHovered, setIsHovered] = useState(false);
    
    const getProductImage = () => {
        if (product.image_url) return product.image_url;
        const name = product.name.toLowerCase().trim();
        const firstWord = name.split(' ')[0].replace(/[()]/g, '');
        return images[`../assets/${name}.jpg`]?.default ||
            images[`../assets/${firstWord}.jpg`]?.default ||
            images[`../assets/${name}.png`]?.default ||
            'https://via.placeholder.com/150?text=Sin+Imagen';
    };

    return (
        <div
            onClick={() => navigate(`/product/${product.id}`)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                backgroundColor: '#FADADD',
                minWidth: '200px',
                width: '200px',
                borderRadius: '20px',
                padding: '15px',
                textAlign: 'center',
                flexShrink: 0,
                boxShadow: isHovered ? '0 10px 25px rgba(0,0,0,0.15)' : '0 4px 12px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                transform: isHovered ? 'translateY(-8px)' : 'none',
            }}
        >
            <div style={{
                width: '100%', height: '120px', marginBottom: '10px',
                backgroundColor: 'white', borderRadius: '15px', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <img src={getProductImage()} alt={product.name} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
            </div>
            <h4 style={{ 
                fontSize: '0.85rem', 
                margin: '10px 0', 
                height: '35px', 
                overflow: 'hidden',
                color: '#333',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: '1.2'
            }}>{product.name}</h4>
            <p style={{ fontWeight: 'bold', color: '#1b5e20', fontSize: '1.2rem', margin: '5px 0' }}>
                ${parseFloat(product.price).toFixed(2)}
            </p>
        </div>
    );
}

export default function PublicLanding() {
    const [products, setProducts] = useState([]);
    const [anuncio, setAnuncio] = useState("");
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState("");
    const navigate = useNavigate();
    const { cart } = useCart();

    const [navigating, setNavigating] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data } = await supabase.from("products").select("*").eq('deleted', false).order('name');
        const prods = data || [];
        setProducts(prods);
        
        if (prods.length > 0) {
            const initialMap = prods.reduce((acc, product) => {
                let seccion = product.category || obtenerSeccion(product.name);
                if (seccion === "PRODUCTOS DE POLLO") seccion = "CARNES";
                if (!acc[seccion]) acc[seccion] = [];
                acc[seccion].push(product);
                return acc;
            }, {});
            
            const sortedKeys = Object.keys(initialMap).sort((a, b) => {
                const indexA = CATEGORY_ORDER.indexOf(a);
                const indexB = CATEGORY_ORDER.indexOf(b);
                if (indexA === -1 && indexB === -1) return a.localeCompare(b);
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            });
            
            if (sortedKeys.length > 0) setSelectedCategory(sortedKeys[0]);
        }
        
        await fetchAnuncio();
        setLoading(false);
    };

    const handleLoginClick = (e) => {
        e.preventDefault();
        setNavigating(true);
        setTimeout(() => {
            navigate("/login");
        }, 800);
    };

    const fetchAnuncio = async () => {
        const { data } = await supabase.from('configuracion').select('valor').eq('id', 'anuncio_dia').maybeSingle();
        if (data && data.valor) {
            let textToShow = "";
            let isPublic = false;
            try {
                const obj = JSON.parse(data.valor);
                if (typeof obj === 'object') {
                    textToShow = obj.text || "";
                    isPublic = (obj.visibilidad === 'todos');
                }
            } catch (e) {
                textToShow = data.valor;
                isPublic = true;
            }
            const lowerText = textToShow.toLowerCase();
            const hasForbiddenWords = lowerText.includes("administrativo") || lowerText.includes("sistema") || lowerText.includes("bienvenido");
            if (isPublic && !hasForbiddenWords) setAnuncio(textToShow);
            else setAnuncio("");
        } else setAnuncio("");
    };

    const obtenerSeccion = (nombre) => {
        const n = nombre.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (n.includes('pavo') || n.includes('conejo') || n.includes('gallina') || n.includes('pato')) return "ANIMALES";
        if (n.includes('huevo') || n.includes('miel')) return "OTROS ALIMENTOS";
        if (n.includes('vacuna') || n.includes('dosis') || n.includes('ml') || n.includes('rabia')) return "VACUNAS Y MEDICINA";
        if (n.includes('leche') || n.includes('requeson') || n.includes('queso') || n.includes('crema') || n.includes('cuajada')) return "LÁCTEOS";
        if (n.includes('pollo') || n.includes('menudo') || n.includes('carne') || n.includes('res') || n.includes('cerdo')) return "CARNES";
        if (n.includes('concentrado') || n.includes('alimento')) return "CONCENTRADOS";
        return "OTROS PRODUCTOS";
    };

    const categoriasMap = products.reduce((acc, product) => {
        let seccion = product.category || obtenerSeccion(product.name);
        if (seccion === "PRODUCTOS DE POLLO") seccion = "CARNES";
        if (!acc[seccion]) acc[seccion] = [];
        acc[seccion].push(product);
        return acc;
    }, {});

    const sortedCategories = Object.keys(categoriasMap).sort((a, b) => {
        const indexA = CATEGORY_ORDER.indexOf(a);
        const indexB = CATEGORY_ORDER.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    if (navigating) {
        return (
            <div className="spinner-overlay">
                <div className="spinner"></div>
                <p style={{ color: '#1b5e20', fontWeight: 'bold' }}>Preparando acceso seguro...</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="spinner-overlay">
                <div className="spinner"></div>
                <p style={{ color: '#1b5e20', fontWeight: 'bold' }}>Cargando catálogo...</p>
            </div>
        );
    }

    return (
        <div style={{ backgroundColor: '#fdfbc0', minHeight: '100vh', paddingBottom: '60px' }}>
            {/* Header Público */}
            <header style={{
                backgroundColor: '#1b5e20',
                padding: '15px 5%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '15px',
                color: 'white',
                position: 'sticky',
                top: 0,
                zIndex: 1000,
                boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
            }}>
                <BrandLogo defaultEmoji="🚜" textStyle={{ margin: 0, fontSize: '1.4rem', fontWeight: 'bold' }} fallbackText="Granja Don Bosco" />
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <Link to="/cart" style={{ color: 'white', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 'bold', position: 'relative', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span>🛒</span> <span>Carrito</span>
                        {cart.length > 0 && (
                            <span style={{
                                backgroundColor: '#d32f2f',
                                color: 'white',
                                fontSize: '0.65rem',
                                padding: '2px 6px',
                                borderRadius: '10px',
                                border: '1px solid white'
                            }}>
                                {cart.length}
                            </span>
                        )}
                    </Link>
                    <a href="/login" onClick={handleLoginClick} style={{
                        color: 'white',
                        textDecoration: 'none',
                        fontSize: '0.9rem',
                        fontWeight: 'bold',
                        border: '1.5px solid white',
                        padding: '6px 16px',
                        borderRadius: '25px'
                    }}>Acceder</a>
                </div>
            </header>

            {/* Hero Section */}
            <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: 'linear-gradient(135deg, #FADADD 0%, #F5CECD 100%)',
                marginBottom: '10px'
            }}>
                <h1 style={{ color: '#1b5e20', fontSize: 'clamp(1.2rem, 4vw, 2.2rem)', margin: '0 0 5px 0' }}>¡Frescura de la Granja a tu Mesa!</h1>
                <p style={{ fontSize: '0.95rem', color: '#444', margin: 0 }}>Productos naturales de alta calidad.</p>
                
                {anuncio && (
                    <div style={{
                        marginTop: '15px',
                        display: 'inline-block',
                        backgroundColor: 'white',
                        padding: '6px 20px',
                        borderRadius: '30px',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
                    }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '600', color: '#1b5e20' }}>
                           📢 {anuncio}
                        </p>
                    </div>
                )}
            </div>

            {/* Navegación por Categorías */}
            <div style={{ 
                padding: '10px 5%', 
                backgroundColor: 'white', 
                position: 'sticky', 
                top: '55px', 
                zIndex: 900,
                display: 'flex',
                gap: '10px',
                overflowX: 'auto',
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch',
                boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
            }}>
                {sortedCategories.map(cat => (
                    <button 
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        style={{
                            padding: '8px 18px',
                            borderRadius: '20px',
                            border: 'none',
                            backgroundColor: selectedCategory === cat ? '#1b5e20' : '#f5f5f5',
                            color: selectedCategory === cat ? 'white' : '#666',
                            fontWeight: 'bold',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s'
                        }}>{cat}</button>
                ))}
            </div>

            {/* Catálogo */}
            <div style={{ padding: '20px 5%' }}>
                {sortedCategories.map((titulo) => {
                    if (selectedCategory && selectedCategory !== titulo) return null;
                    
                    return (
                        <section key={titulo} style={{ marginBottom: '30px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                                <h2 style={{
                                    color: '#1b5e20', fontSize: '1.1rem', textTransform: 'uppercase', margin: 0, fontWeight: '900'
                                }}>
                                    {titulo}
                                </h2>
                                <div style={{ height: '1px', flex: 1, backgroundColor: '#1b5e20', opacity: 0.1 }}></div>
                            </div>
                            
                            <div style={{
                                display: 'flex',
                                overflowX: 'auto',
                                gap: '15px',
                                paddingBottom: '10px',
                                scrollbarWidth: 'thin',
                                WebkitOverflowScrolling: 'touch'
                            }}>
                                {categoriasMap[titulo].map((product) => (
                                    <PublicProductCard key={product.id} product={product} navigate={navigate} />
                                ))}
                            </div>
                        </section>
                    );
                })}
            </div>

            {/* Footer */}
            <footer style={{
                marginTop: '40px',
                backgroundColor: '#1b5e20',
                color: 'white',
                padding: '30px 5%',
                textAlign: 'center'
            }}>
                <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>© 2026 Granja Don Bosco - Calidad Garantizada.</p>
            </footer>
        </div>
    );
}
