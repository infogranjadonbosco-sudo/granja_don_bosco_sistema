import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export function BrandLogo({ defaultEmoji = "🚜", style = {}, imageStyle = {}, textStyle = {}, showText = true, fallbackText = "Granja Don Bosco" }) {
    const [logoError, setLogoError] = useState(false);
    const [cacheBuster, setCacheBuster] = useState(localStorage.getItem('logo_version') || '1');

    useEffect(() => {
        const handleLogoUpdate = () => {
            setCacheBuster(localStorage.getItem('logo_version') || Date.now().toString());
            setLogoError(false); // Reiniciar el error para intentar cargar la nueva imagen
        };
        window.addEventListener('logoUpdated', handleLogoUpdate);
        return () => window.removeEventListener('logoUpdated', handleLogoUpdate);
    }, []);

    // Tomamos la URL del bucket 'products', que ya existe y es público
    const { data: publicUrlData } = supabase.storage.from('products').getPublicUrl('brand_logo.png');
    // Le agregamos el cacheBuster para que si subimos uno nuevo, el navegador lo recargue
    const logoUrl = `${publicUrlData.publicUrl}?v=${cacheBuster}`;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', ...style }}>
            {!logoError ? (
                <img 
                    src={logoUrl} 
                    alt="Logo Empresa" 
                    onError={() => setLogoError(true)}
                    style={{ height: '35px', width: '35px', objectFit: 'contain', borderRadius: '5px', ...imageStyle }}
                />
            ) : (
                <img 
                    src="/brand_logo.png" 
                    alt="Logo Empresa Fallback" 
                    style={{ height: '35px', width: '35px', objectFit: 'contain', borderRadius: '5px', ...imageStyle }}
                />
            )}
            {showText && <span style={{ ...textStyle }}>{fallbackText}</span>}
        </div>
    );
}

// Función que el botón de subir logo llamará
export const uploadBrandLogo = async (file) => {
    if (!file) return { error: { message: "Sin archivo" } };
    const { error, data } = await supabase.storage.from('products').upload('brand_logo.png', file, { 
        upsert: true, 
        contentType: file.type 
    });
    if (!error) {
        localStorage.setItem('logo_version', Date.now().toString());
        window.dispatchEvent(new Event('logoUpdated'));
    }
    return { error, data };
};
export const removeBrandLogo = async () => {
    const { error } = await supabase.storage.from('products').remove(['brand_logo.png']);
    if (!error) {
        localStorage.setItem('logo_version', Date.now().toString());
        window.dispatchEvent(new Event('logoUpdated'));
    }
    return { error };
};
