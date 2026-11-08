export function Icon({ name }: { name: string }) {
  const files: Record<string, string> = {
    dashboard: 'imgFrame',
    elevators: 'imgFrame1',
    notices: 'imgFrame2',
    logout: 'imgFrame3',
    bell: 'imgFrame4',
    arrow: 'imgFrame6',
    download: 'imgFrame8',
    tick: 'imgFrame7',
    calendar: 'calendar',
    register: 'check',
    failed: 'failed',
    complaints: 'complaints',
    check: 'check',
  };

  return (
    <img
      className="icon"
      src={`/assets/${files[name] || 'imgFrame1'}.svg`}
      alt=""
      aria-hidden="true"
      width={20}
      height={20}
    />
  );
}
