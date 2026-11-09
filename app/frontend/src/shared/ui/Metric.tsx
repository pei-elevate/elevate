export function Metric({
  label,
  value,
  description,
  tone = '',
}: {
  label: string;
  value: string | number;
  description: string;
  tone?: string;
}) {
  return (
    <article className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{description}</small>
    </article>
  );
}
