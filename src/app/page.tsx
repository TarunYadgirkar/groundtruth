import Navigator from "@/components/Navigator";
import { MapProvider } from "@/components/map/MapProvider";

export default function Home() {
  return (
    <MapProvider>
      <Navigator />
    </MapProvider>
  );
}
