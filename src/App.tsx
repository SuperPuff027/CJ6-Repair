import { Buehne } from './ui/Buehne';
import { Leiste } from './ui/Leiste';
import { useThema } from './ui/useThema';

export function App() {
  const { thema, umschalten } = useThema();
  return (
    <>
      <Leiste thema={thema} themaUmschalten={umschalten} />
      <Buehne thema={thema} />
    </>
  );
}
