'use client';

import HelpButton from './HelpButton';

export default function ScoringRulesHelpButton() {
  return (
    <HelpButton title="¿Cómo ganar puntos?" buttonLabel="¿Cómo ganar puntos?">
      <div className="space-y-6">
        <section>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Fase de grupos</h3>
          <div className="mt-3 space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-blue-600 dark:text-blue-400">5 puntos</span>
              <span className="text-sm">por marcador exacto</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-blue-600 dark:text-blue-400">2 puntos</span>
              <span className="text-sm">por resultado correcto</span>
            </div>
          </div>
          <p className="mt-3 text-sm">
            Si aciertas el marcador exacto, ganas más puntos. Si no aciertas el marcador pero sí el ganador o empate, ganas puntos por resultado correcto.
          </p>
          <p className="mt-2 text-sm italic text-zinc-600 dark:text-zinc-400">
            Ejemplo: Si predices Francia 2-1 Brasil y el partido queda Francia 1-0 Brasil, acertaste el ganador, pero no el marcador exacto.
          </p>
        </section>

        <section>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Fase eliminatoria</h3>
          <div className="mt-3 space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-blue-600 dark:text-blue-400">10 puntos</span>
              <span className="text-sm">por marcador exacto</span>
            </div>
          </div>
          <p className="mt-3 text-sm">
            En eliminatorias también importa el equipo que avanza. Si predices empate, debes elegir quién clasifica.
          </p>
        </section>

        <section>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Clasificados y avances</h3>
          <div className="mt-3 space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-blue-600 dark:text-blue-400">20 puntos</span>
              <span className="text-sm">si el equipo llega a dieciseisavos</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-blue-600 dark:text-blue-400">35 puntos</span>
              <span className="text-sm">si el equipo llega a octavos</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-blue-600 dark:text-blue-400">55 puntos</span>
              <span className="text-sm">si el equipo llega a cuartos</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-blue-600 dark:text-blue-400">80 puntos</span>
              <span className="text-sm">si el equipo llega a semifinales</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-blue-600 dark:text-blue-400">110 puntos</span>
              <span className="text-sm">si el equipo llega a la final</span>
            </div>
          </div>
        </section>

        <section>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Predicciones finales</h3>
          <div className="mt-3 space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-blue-600 dark:text-blue-400">150 puntos</span>
              <span className="text-sm">por campeón del torneo</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-blue-600 dark:text-blue-400">80 puntos</span>
              <span className="text-sm">por tercer puesto</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-blue-600 dark:text-blue-400">60 puntos</span>
              <span className="text-sm">por goleador del torneo</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-blue-600 dark:text-blue-400">60 puntos</span>
              <span className="text-sm">por mejor arquero del torneo</span>
            </div>
          </div>
        </section>

        <section className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            La tabla de puntuaciones se actualiza cuando el administrador registra resultados oficiales.
          </p>
        </section>
      </div>
    </HelpButton>
  );
}
