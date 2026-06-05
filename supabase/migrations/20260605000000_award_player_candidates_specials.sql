create table public.award_player_candidates (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  display_name text not null,
  team_id uuid nullable references public.teams(id) on delete set null,
  team_code text nullable,
  position text nullable,
  award_categories text[] not null default '{}',
  aliases text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint award_player_candidates_full_name_length check (char_length(full_name) between 2 and 120),
  constraint award_player_candidates_display_name_length check (char_length(display_name) between 1 and 120)
);

create index idx_award_player_candidates_active on public.award_player_candidates (is_active);
create index idx_award_player_candidates_team_code on public.award_player_candidates (team_code);
create index idx_award_player_candidates_position on public.award_player_candidates (position);
create index idx_award_player_candidates_award_categories on public.award_player_candidates using gin (award_categories);
create index idx_award_player_candidates_aliases on public.award_player_candidates using gin (aliases);

create trigger award_player_candidates_updated_at
  before update on public.award_player_candidates
  for each row execute function public.set_updated_at();

alter table public.award_player_candidates enable row level security;

create policy "award_player_candidates_select_active_authenticated"
  on public.award_player_candidates for select
  to authenticated
  using (is_active = true);

create policy "award_player_candidates_insert_global_admin"
  on public.award_player_candidates for insert
  to authenticated
  with check (public.is_global_admin());

create policy "award_player_candidates_update_global_admin"
  on public.award_player_candidates for update
  to authenticated
  using (public.is_global_admin())
  with check (public.is_global_admin());

create policy "award_player_candidates_delete_global_admin"
  on public.award_player_candidates for delete
  to authenticated
  using (public.is_global_admin());

alter table public.predictions_specials
  add column top_scorer_candidate_id uuid references public.award_player_candidates(id) on delete set null,
  add column top_scorer_other_name text,
  add column top_scorer_other_team_id uuid references public.teams(id) on delete set null,
  add column best_goalkeeper_candidate_id uuid references public.award_player_candidates(id) on delete set null,
  add column best_goalkeeper_name text,
  add column best_goalkeeper_other_name text,
  add column best_goalkeeper_other_team_id uuid references public.teams(id) on delete set null;

alter table public.predictions_specials
  add constraint predictions_specials_top_scorer_other_length check (top_scorer_other_name is null or char_length(top_scorer_other_name) between 2 and 100),
  add constraint predictions_specials_best_goalkeeper_length check (best_goalkeeper_name is null or char_length(best_goalkeeper_name) between 2 and 100),
  add constraint predictions_specials_best_goalkeeper_other_length check (best_goalkeeper_other_name is null or char_length(best_goalkeeper_other_name) between 2 and 100),
  add constraint predictions_specials_top_scorer_consistent check (top_scorer_candidate_id is null or top_scorer_other_name is null),
  add constraint predictions_specials_best_goalkeeper_consistent check (best_goalkeeper_candidate_id is null or best_goalkeeper_other_name is null);

alter table public.tournament_results
  add column top_scorer_candidate_id uuid references public.award_player_candidates(id) on delete set null,
  add column best_goalkeeper_candidate_id uuid references public.award_player_candidates(id) on delete set null,
  add column best_goalkeeper_name text;

alter table public.tournament_results
  add constraint tournament_results_best_goalkeeper_length check (best_goalkeeper_name is null or char_length(best_goalkeeper_name) between 2 and 100);

alter table public.score_breakdowns
  add column best_goalkeeper_points int not null default 0;

alter table public.score_breakdowns
  add constraint score_breakdowns_best_goalkeeper_non_neg check (best_goalkeeper_points >= 0);

insert into public.award_player_candidates (full_name, display_name, team_code, position, award_categories, aliases)
values
('Kylian Mbappé','Mbappé','FRA','forward',ARRAY['top_scorer']::text[],ARRAY['Mbappe','Mbappé','K. Mbappé']::text[]),
('Harry Kane','Kane','ENG','forward',ARRAY['top_scorer']::text[],ARRAY['H. Kane']::text[]),
('Erling Haaland','Haaland','NOR','forward',ARRAY['top_scorer']::text[],ARRAY['E. Haaland']::text[]),
('Lionel Messi','Messi','ARG','forward',ARRAY['top_scorer']::text[],ARRAY['L. Messi']::text[]),
('Julián Álvarez','J. Álvarez','ARG','forward',ARRAY['top_scorer']::text[],ARRAY['Julian Alvarez','Álvarez']::text[]),
('Lautaro Martínez','Lautaro','ARG','forward',ARRAY['top_scorer']::text[],ARRAY['Lautaro Martinez']::text[]),
('Vinícius Júnior','Vinícius Jr.','BRA','forward',ARRAY['top_scorer']::text[],ARRAY['Vinicius Junior','Vini Jr']::text[]),
('Rodrygo Goes','Rodrygo','BRA','forward',ARRAY['top_scorer']::text[],ARRAY['Rodrygo']::text[]),
('Raphinha','Raphinha','BRA','forward',ARRAY['top_scorer']::text[],ARRAY[]::text[]),
('Neymar Júnior','Neymar','BRA','forward',ARRAY['top_scorer']::text[],ARRAY['Neymar Jr']::text[]),
('Cristiano Ronaldo','Cristiano Ronaldo','POR','forward',ARRAY['top_scorer']::text[],ARRAY['CR7','Ronaldo']::text[]),
('Rafael Leão','Rafael Leão','POR','forward',ARRAY['top_scorer']::text[],ARRAY['Rafael Leao','Leão']::text[]),
('Gonçalo Ramos','Gonçalo Ramos','POR','forward',ARRAY['top_scorer']::text[],ARRAY['Goncalo Ramos']::text[]),
('Phil Foden','Foden','ENG','midfielder',ARRAY['top_scorer']::text[],ARRAY['P. Foden']::text[]),
('Bukayo Saka','Saka','ENG','forward',ARRAY['top_scorer']::text[],ARRAY['B. Saka']::text[]),
('Jude Bellingham','Bellingham','ENG','midfielder',ARRAY['top_scorer']::text[],ARRAY['J. Bellingham']::text[]),
('Marcus Rashford','Rashford','ENG','forward',ARRAY['top_scorer']::text[],ARRAY['M. Rashford']::text[]),
('Antoine Griezmann','Griezmann','FRA','forward',ARRAY['top_scorer']::text[],ARRAY['A. Griezmann']::text[]),
('Ousmane Dembélé','Dembélé','FRA','forward',ARRAY['top_scorer']::text[],ARRAY['Dembele','O. Dembélé']::text[]),
('Olivier Giroud','Giroud','FRA','forward',ARRAY['top_scorer']::text[],ARRAY['O. Giroud']::text[]),
('Florian Wirtz','Wirtz','GER','midfielder',ARRAY['top_scorer']::text[],ARRAY['F. Wirtz']::text[]),
('Jamal Musiala','Musiala','GER','midfielder',ARRAY['top_scorer']::text[],ARRAY['J. Musiala']::text[]),
('Kai Havertz','Havertz','GER','forward',ARRAY['top_scorer']::text[],ARRAY['K. Havertz']::text[]),
('Niclas Füllkrug','Füllkrug','GER','forward',ARRAY['top_scorer']::text[],ARRAY['Fullkrug','N. Füllkrug']::text[]),
('Álvaro Morata','Morata','ESP','forward',ARRAY['top_scorer']::text[],ARRAY['Alvaro Morata']::text[]),
('Lamine Yamal','Lamine Yamal','ESP','forward',ARRAY['top_scorer']::text[],ARRAY['Yamal']::text[]),
('Nico Williams','Nico Williams','ESP','forward',ARRAY['top_scorer']::text[],ARRAY['N. Williams']::text[]),
('Dani Olmo','Dani Olmo','ESP','midfielder',ARRAY['top_scorer']::text[],ARRAY['Olmo']::text[]),
('Pedri González','Pedri','ESP','midfielder',ARRAY['top_scorer']::text[],ARRAY['Pedri']::text[]),
('Gavi Páez','Gavi','ESP','midfielder',ARRAY['top_scorer']::text[],ARRAY['Gavi']::text[]),
('Álvaro Rodríguez','Álvaro Rodríguez','URU','forward',ARRAY['top_scorer']::text[],ARRAY['Alvaro Rodriguez']::text[]),
('Darwin Núñez','Darwin Núñez','URU','forward',ARRAY['top_scorer']::text[],ARRAY['Darwin Nunez','Núñez']::text[]),
('Federico Valverde','Valverde','URU','midfielder',ARRAY['top_scorer']::text[],ARRAY['F. Valverde']::text[]),
('Luis Suárez','Luis Suárez','URU','forward',ARRAY['top_scorer']::text[],ARRAY['Luis Suarez']::text[]),
('Santiago Giménez','Santiago Giménez','MEX','forward',ARRAY['top_scorer']::text[],ARRAY['Santi Gimenez','Giménez']::text[]),
('Raúl Jiménez','Raúl Jiménez','MEX','forward',ARRAY['top_scorer']::text[],ARRAY['Raul Jimenez','Jiménez']::text[]),
('Hirving Lozano','Lozano','MEX','forward',ARRAY['top_scorer']::text[],ARRAY['Chucky Lozano']::text[]),
('Christian Pulisic','Pulisic','USA','forward',ARRAY['top_scorer']::text[],ARRAY['C. Pulisic']::text[]),
('Folarin Balogun','Balogun','USA','forward',ARRAY['top_scorer']::text[],ARRAY['F. Balogun']::text[]),
('Giovanni Reyna','Reyna','USA','midfielder',ARRAY['top_scorer']::text[],ARRAY['Gio Reyna']::text[]),
('Jonathan David','Jonathan David','CAN','forward',ARRAY['top_scorer']::text[],ARRAY['David']::text[]),
('Alphonso Davies','Davies','CAN','midfielder',ARRAY['top_scorer']::text[],ARRAY['A. Davies']::text[]),
('Cody Gakpo','Gakpo','NED','forward',ARRAY['top_scorer']::text[],ARRAY['C. Gakpo']::text[]),
('Memphis Depay','Depay','NED','forward',ARRAY['top_scorer']::text[],ARRAY['Memphis']::text[]),
('Xavi Simons','Xavi Simons','NED','midfielder',ARRAY['top_scorer']::text[],ARRAY['Simons']::text[]),
('Donyell Malen','Malen','NED','forward',ARRAY['top_scorer']::text[],ARRAY['D. Malen']::text[]),
('Romelu Lukaku','Lukaku','BEL','forward',ARRAY['top_scorer']::text[],ARRAY['R. Lukaku']::text[]),
('Kevin De Bruyne','De Bruyne','BEL','midfielder',ARRAY['top_scorer']::text[],ARRAY['KDB']::text[]),
('Leandro Trossard','Trossard','BEL','forward',ARRAY['top_scorer']::text[],ARRAY['L. Trossard']::text[]),
('Youssef En-Nesyri','En-Nesyri','MAR','forward',ARRAY['top_scorer']::text[],ARRAY['En Nesyri']::text[]),
('Achraf Hakimi','Hakimi','MAR','defender',ARRAY['top_scorer']::text[],ARRAY['A. Hakimi']::text[]),
('Hakim Ziyech','Ziyech','MAR','midfielder',ARRAY['top_scorer']::text[],ARRAY['H. Ziyech']::text[]),
('Victor Osimhen','Osimhen','NGA','forward',ARRAY['top_scorer']::text[],ARRAY['V. Osimhen']::text[]),
('Ademola Lookman','Lookman','NGA','forward',ARRAY['top_scorer']::text[],ARRAY['A. Lookman']::text[]),
('Mohamed Salah','Salah','EGY','forward',ARRAY['top_scorer']::text[],ARRAY['M. Salah']::text[]),
('Son Heung-min','Son','KOR','forward',ARRAY['top_scorer']::text[],ARRAY['Heung-min Son','Sonny']::text[]),
('Lee Kang-in','Lee Kang-in','KOR','midfielder',ARRAY['top_scorer']::text[],ARRAY['Kang-in Lee']::text[]),
('Takefusa Kubo','Kubo','JPN','midfielder',ARRAY['top_scorer']::text[],ARRAY['T. Kubo']::text[]),
('Kaoru Mitoma','Mitoma','JPN','forward',ARRAY['top_scorer']::text[],ARRAY['K. Mitoma']::text[]),
('Mehdi Taremi','Taremi','IRN','forward',ARRAY['top_scorer']::text[],ARRAY['M. Taremi']::text[]),
('Sardar Azmoun','Azmoun','IRN','forward',ARRAY['top_scorer']::text[],ARRAY['S. Azmoun']::text[]),
('Salem Al-Dawsari','Al-Dawsari','KSA','forward',ARRAY['top_scorer']::text[],ARRAY['Salem']::text[]),
('Aleksandar Mitrović','Mitrović','SRB','forward',ARRAY['top_scorer']::text[],ARRAY['Mitrovic']::text[]),
('Dušan Vlahović','Vlahović','SRB','forward',ARRAY['top_scorer']::text[],ARRAY['Dusan Vlahovic']::text[]),
('Luka Jović','Jović','SRB','forward',ARRAY['top_scorer']::text[],ARRAY['Luka Jovic']::text[]),
('Robert Lewandowski','Lewandowski','POL','forward',ARRAY['top_scorer']::text[],ARRAY['R. Lewandowski']::text[]),
('Piotr Zieliński','Zieliński','POL','midfielder',ARRAY['top_scorer']::text[],ARRAY['Zielinski']::text[]),
('Khvicha Kvaratskhelia','Kvaratskhelia','GEO','forward',ARRAY['top_scorer']::text[],ARRAY['Kvara']::text[]),
('Giorgi Mikautadze','Mikautadze','GEO','forward',ARRAY['top_scorer']::text[],ARRAY['G. Mikautadze']::text[]),
('Serge Gnabry','Gnabry','GER','forward',ARRAY['top_scorer']::text[],ARRAY['S. Gnabry']::text[]),
('Kingsley Coman','Coman','FRA','forward',ARRAY['top_scorer']::text[],ARRAY['K. Coman']::text[]),
('Randal Kolo Muani','Kolo Muani','FRA','forward',ARRAY['top_scorer']::text[],ARRAY['R. Kolo Muani']::text[]),
('Cole Palmer','Palmer','ENG','midfielder',ARRAY['top_scorer']::text[],ARRAY['C. Palmer']::text[]),
('Eberechi Eze','Eze','ENG','midfielder',ARRAY['top_scorer']::text[],ARRAY['E. Eze']::text[]),
('Endrick Felipe','Endrick','BRA','forward',ARRAY['top_scorer']::text[],ARRAY['Endrick']::text[]),
('Gabriel Martinelli','Martinelli','BRA','forward',ARRAY['top_scorer']::text[],ARRAY['G. Martinelli']::text[]),
('João Félix','João Félix','POR','forward',ARRAY['top_scorer']::text[],ARRAY['Joao Felix']::text[]),
('Bernardo Silva','Bernardo Silva','POR','midfielder',ARRAY['top_scorer']::text[],ARRAY['B. Silva']::text[]),
('Federico Chiesa','Chiesa','ITA','forward',ARRAY['top_scorer']::text[],ARRAY['F. Chiesa']::text[]),
('Giacomo Raspadori','Raspadori','ITA','forward',ARRAY['top_scorer']::text[],ARRAY['G. Raspadori']::text[]),
('Ciro Immobile','Immobile','ITA','forward',ARRAY['top_scorer']::text[],ARRAY['C. Immobile']::text[]),
('Dusan Tadic','Tadić','SRB','forward',ARRAY['top_scorer']::text[],ARRAY['Tadic']::text[]),
('Andrej Kramarić','Kramarić','CRO','forward',ARRAY['top_scorer']::text[],ARRAY['Kramaric']::text[]),
('Luka Modrić','Modrić','CRO','midfielder',ARRAY['top_scorer']::text[],ARRAY['Modric']::text[]),
('Benjamin Šeško','Šeško','SVN','forward',ARRAY['top_scorer']::text[],ARRAY['Sesko']::text[]),
('Artem Dovbyk','Dovbyk','UKR','forward',ARRAY['top_scorer']::text[],ARRAY['A. Dovbyk']::text[]),
('Mykhailo Mudryk','Mudryk','UKR','forward',ARRAY['top_scorer']::text[],ARRAY['M. Mudryk']::text[]),
('Gareth Bale','Bale','WAL','forward',ARRAY['top_scorer']::text[],ARRAY['G. Bale']::text[]),
('Emiliano Martínez','Dibu Martínez','ARG','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['Dibu Martinez','E. Martínez']::text[]),
('Alisson Becker','Alisson','BRA','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['Alisson']::text[]),
('Ederson Moraes','Ederson','BRA','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['Ederson']::text[]),
('Thibaut Courtois','Courtois','BEL','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['T. Courtois']::text[]),
('Mike Maignan','Maignan','FRA','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['M. Maignan']::text[]),
('Hugo Lloris','Lloris','FRA','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['H. Lloris']::text[]),
('Jordan Pickford','Pickford','ENG','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['J. Pickford']::text[]),
('Manuel Neuer','Neuer','GER','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['M. Neuer']::text[]),
('Marc-André ter Stegen','ter Stegen','GER','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['Ter Stegen']::text[]),
('Unai Simón','Unai Simón','ESP','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['Unai Simon']::text[]),
('Diogo Costa','Diogo Costa','POR','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['D. Costa']::text[]),
('Andriy Lunin','Lunin','UKR','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['A. Lunin']::text[]),
('Gianluigi Donnarumma','Donnarumma','ITA','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['Gigi Donnarumma']::text[]),
('Wojciech Szczęsny','Szczęsny','POL','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['Szczesny']::text[]),
('Dominik Livaković','Livaković','CRO','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['Livakovic']::text[]),
('Yassine Bounou','Bono','MAR','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['Bounou','Y. Bounou']::text[]),
('Guillermo Ochoa','Ochoa','MEX','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['Memo Ochoa']::text[]),
('Matt Turner','Turner','USA','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['M. Turner']::text[]),
('Milan Borjan','Borjan','CAN','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['M. Borjan']::text[]),
('Bart Verbruggen','Verbruggen','NED','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['B. Verbruggen']::text[]),
('Justin Bijlow','Bijlow','NED','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['J. Bijlow']::text[]),
('Koen Casteels','Casteels','BEL','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['K. Casteels']::text[]),
('Gregor Kobel','Kobel','SUI','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['G. Kobel']::text[]),
('Yann Sommer','Sommer','SUI','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['Y. Sommer']::text[]),
('Kasper Schmeichel','Schmeichel','DEN','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['K. Schmeichel']::text[]),
('Frederik Rønnow','Rønnow','DEN','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['Frederik Ronnow','Rønnow']::text[]),
('Hugo Souza','Hugo Souza','BRA','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['Hugo']::text[]),
('Zion Suzuki','Zion Suzuki','JPN','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['Suzuki']::text[]),
('Shuichi Gonda','Gonda','JPN','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['S. Gonda']::text[]),
('Kim Seung-gyu','Kim Seung-gyu','KOR','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['Seung-gyu Kim']::text[]),
('Cho Hyun-woo','Cho Hyun-woo','KOR','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['Hyun-woo Cho']::text[]),
('Alireza Beiranvand','Beiranvand','IRN','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['A. Beiranvand']::text[]),
('Mohammed Al-Owais','Al-Owais','KSA','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['M. Al-Owais']::text[]),
('Predrag Rajković','Rajković','SRB','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['Rajkovic']::text[]),
('Đorđe Petrović','Petrović','SRB','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['Djordje Petrovic']::text[]),
('Sergio Rochet','Rochet','URU','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['S. Rochet']::text[]),
('Fernando Muslera','Muslera','URU','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['F. Muslera']::text[]),
('Wayne Hennessey','Hennessey','WAL','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['W. Hennessey']::text[]),
('Giorgi Mamardashvili','Mamardashvili','GEO','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['G. Mamardashvili']::text[]),
('Jan Oblak','Oblak','SVN','goalkeeper',ARRAY['best_goalkeeper']::text[],ARRAY['J. Oblak']::text[])
on conflict do nothing;

update public.award_player_candidates apc
set team_id = teams.id
from public.teams
where apc.team_id is null and apc.team_code = teams.code;
