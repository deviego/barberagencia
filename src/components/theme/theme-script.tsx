/**
 * Script inline que aplica o tema salvo (dark/light) ANTES da primeira pintura,
 * evitando flash. Renderizado no <head>. Default = dark (padrão da marca).
 */
export function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem('bb-theme');if(t!=='light'&&t!=='dark'){t='dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
