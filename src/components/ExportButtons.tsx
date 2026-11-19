import { FileDown } from 'lucide-react';
import { usePlugins } from '../hooks/usePlugins';
import { exportDeck } from '../io/commands';
import { exportersOf } from '../plugins/host';
import { IconButton } from './IconButton';

function IconFromPlugin({ svg }: { svg: string }) {
  return <span className="exporter-icon" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function ExportButtons() {
  const exporters = exportersOf(usePlugins());
  return (
    <div className="group">
      {exporters.map((entry) => {
        const { exporter } = entry;
        return (
          <IconButton
            key={`${entry.pluginName}/${exporter.id}`}
            label={`書き出し: ${exporter.title} (.${exporter.extension})`}
            onClick={() => void exportDeck(entry)}
          >
            {exporter.icon ? <IconFromPlugin svg={exporter.icon} /> : <FileDown />}
          </IconButton>
        );
      })}
    </div>
  );
}
