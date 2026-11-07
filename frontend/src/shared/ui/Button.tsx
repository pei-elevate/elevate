import type { ButtonHTMLAttributes } from 'react';

// TODO: há 38 <button> escritos diretamente nas páginas sem `type`, que por omissão é "submit"
// (dentro de um <form>, submetia-o). Hoje nenhum está dentro de um formulário. Passá-los a usar
// este componente (ou dar-lhes um `type` explícito) e depois ligar a regra useButtonType no
// biome.jsonc. `npm run lint` com a regra ligada lista-os todos.
export function Button({
  children,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={`button ${className}`} {...props}>
      {children}
    </button>
  );
}
