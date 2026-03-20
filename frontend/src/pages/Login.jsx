import React, { useState } from 'react';
import './login.css';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate(); // Inicializamos navigate

  const handleLogin = async (e) => {
    e.preventDefault();

    // posible rescate de emergencia
    if (email === "RESCATE") {
      try {
        const adminUsers = [
          { email: 'roberto.medina@granjadonbosco.com', password: 'RMedina.2026.GDB!', nombre: 'Roberto Medina', depto: 'Dirección General' },
          { email: 'francisco.mejia@granjadonbosco.com', password: 'FMejia.2026.GDB!', nombre: 'Francisco Mejía', depto: 'Operaciones' },
          { email: 'roberto.alas@granjadonbosco.com', password: 'RAlas.2026.GDB!', nombre: 'Ricardo Alas', depto: 'Subgerencia' }
        ];

        for (const admin of adminUsers) {
          // Creamos el usuario en el sistema de autenticación
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: admin.email,
            password: admin.password,
          });

          if (authData?.user) {
            // Le damos permisos de administrador en la tabla de usuarios
            await supabase.from('usuarios').upsert({
              id: authData.user.id,
              correo: admin.email,
              nombre_completo: admin.nombre,
              departamento: admin.depto,
              rol: 'admin',
              puede_editar: true
            });
          }
        }
        alert('¡SISTEMA RECONSTRUIDO! Todos los administradores han sido creados/restablecidos.');
      } catch (err) {
        alert('Error en reconstrucción: ' + err.message);
      }
      return;
    }

    // Intentamos iniciar sesión con el correo y contraseña que ingresó
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(`Error al ingresar: ${error.message} (Verifique su correo y clave)`);
    } else {
      // Si todo salió bien, lo mandamos al inicio y la app decide si va al panel admin o al de colaborador
      navigate('/');
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      alert("Por favor, ingresa tu correo arriba y luego haz clic en 'Olvidé mi contraseña'.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/profile',
    });

    if (error) {
      alert("Error: " + error.message);
    } else {
      alert("Te hemos enviado un correo con instrucciones para restablecer tu contraseña. Revisa tu bandeja de entrada.");
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="logo-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <BrandLogo defaultEmoji="🌾" showText={false} imageStyle={{ width: '80px', height: '80px', borderRadius: '15px' }} style={{ justifyContent: 'center' }} />
          <h1 className="brand-name">Granja Don Bosco</h1>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <input
            type="text"
            placeholder="correo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="login-button">
            Ingresar
          </button>

          <button
            type="button"
            onClick={handleResetPassword}
            style={{
              background: 'none',
              border: 'none',
              color: '#1b5e20',
              textDecoration: 'underline',
              cursor: 'pointer',
              marginTop: '15px',
              fontSize: '0.9rem'
            }}
          >
            ¿Olvidaste tu contraseña?
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;


