import AdminPlaceholder from '../_components/AdminPlaceholder';

export const metadata = { title: 'Cycles · Admin Mentora' };

export default function CyclesPage() {
  return (
    <AdminPlaceholder
      title="Cycles Mentora"
      subtitle="Mentora · Pilotage des cohortes"
      description="Gestion des cohortes saisonnières (Printemps, Automne…). Vous pourrez créer un cycle, définir ses phases (Onboarding → Matching → Sessions → Bilan) et suivre la progression. La mise en production de cette page nécessite l'ajout du modèle Cycle en base — prochaine livraison."
      upcomingFeatures={[
        "Créer un nouveau cycle (nom, dates, phases)",
        "Phases automatiques avec dates de transition",
        "Archivage des cycles terminés",
        "Vue comparative cycle par cycle (KPI, satisfaction)",
      ]}
    />
  );
}
