/**
 * Nomes dos destinatários de um aviso. A API guarda «Nome <email>; Nome <email>»; na tabela
 * só interessa o nome.
 */
export function recipientNames(value: string) {
  return value
    .split(';')
    .map((part) => part.replace(/<[^>]*>/, '').trim())
    .filter(Boolean);
}

// Um destinatário por linha, para se ler melhor na coluna estreita da tabela.
export function Recipients({ value }: { value: string }) {
  return (
    <ul className="recipients">
      {recipientNames(value).map((name) => (
        <li key={name}>{name}</li>
      ))}
    </ul>
  );
}
