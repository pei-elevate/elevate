import { useEffect, useState } from 'react';

export function SummaryReport({ id, result }: { id: string; result: string }) {
  return (
    <dl className="summary">
      <div>
        <dt>Referência</dt>
        <dd>{id}</dd>
      </div>
      <div>
        <dt>Resultado</dt>
        <dd>{result}</dd>
      </div>
    </dl>
  );
}

export function DocumentLink({ file }: { file: File }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const object = URL.createObjectURL(file);
    setUrl(object);

    return () => URL.revokeObjectURL(object);
  }, [file]);

  return (
    <>
      <p>{file.name}</p>
      <a className="button primary" href={url} download={file.name}>
        Descarregar relatório
      </a>
    </>
  );
}
