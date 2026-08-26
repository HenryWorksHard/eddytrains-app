import json, os
SP = os.path.dirname(os.path.abspath(__file__))
exec(open(SP+'/progs.py').read())

ORG = 'a15a91b9-586f-4633-8671-20b4ef1a86e9'
WARMMAP = {"Ankle Circles":["7bce523c-77cc-4801-b8d1-a54848029f45","mobility"],
"Chest And Front Of Shoulder Stretch":["4d5461f9-9c95-405c-99e0-24ad4754f526","stretching"],
"Hamstring Stretch":["fab2c467-1013-4064-947d-88eaab43730e","stretching"],
"Hug Knees To Chest":["1252dee0-78fa-4135-a8b8-4ca2a2ac8158","mobility"],
"Intermediate Hip Flexor And Quad Stretch":["d91bb6ff-77b6-4dce-adc2-a4daad0b9ae7","stretching"],
"Neck Side Stretch":["997411cd-806e-47ff-a6bd-602914918807","stretching"],
"Scapula Push-Up":["9ff66c24-a561-4695-b940-ff65b2badfaf","mobility"],
"Seated Glute Stretch":["2b2ea7fb-7c21-4061-8ef5-133f930972cc","stretching"],
"Sphinx":["61e97ace-e8ea-415e-bb56-27f2fe1dc9cc","mobility"],
"Spine Twist":["346b5776-9127-47de-8b52-c1cd0a208f17","mobility"],
"Standing Pelvic Tilt":["ccd7d1a2-5176-4101-bc98-940ea882c1f1","mobility"],
"Upper Back Stretch":["d6a3886f-28c8-4909-b7a8-619ce57554a5","stretching"],
"World Greatest Stretch":["eb229fec-c494-4139-b795-928d846f9c59","mobility"]}
PHNOTE = {1: P1N, 2: P2N, 3: P3N}

def q(s):
    return "'" + str(s).replace("'", "''") + "'"

def resolve_warm(warm):
    out = []
    for w in warm:
        nm = w['exerciseName']
        wid, cat = WARMMAP[nm]
        w2 = dict(w); w2['exerciseId'] = wid; w2['category'] = cat
        out.append(w2)
    return json.dumps(out, ensure_ascii=False)

def emit(p):
    weeks = p['weeks']; phases = PHASES[weeks]
    wk = [(w, i+1) for i, ws in enumerate(phases) for w in ws]
    assert sorted(w for w,_ in wk) == list(range(1, weeks+1)), p['slug']

    L = []
    L.append("with p as (")
    L.append("  insert into programs (name, description, category, difficulty, duration_weeks,")
    L.append("                        is_active, organization_id, program_kind, slug, emoji)")
    L.append("  values (%s, %s, 'strength', %s, %d, true, %s, 'catalog', %s, %s)" % (
        q(p['name']), q(p['desc']), q(p['difficulty']), weeks, q(ORG), q(p['slug']), q(p['emoji'])))
    L.append("  returning id"); L.append("),")

    L.append("wk(week, phase) as (values " + ", ".join("(%d,%d)" % (w, ph) for w, ph in wk) + "),")

    L.append("dayinfo(dow, ord, title, warmup) as (values " + ",\n  ".join(
        "(%d,%d,%s,%s)" % (d['dow'], d['ord'], q(d['title']), q(resolve_warm(d['warm'])))
        for d in p['days']) + "),")
    L.append("phasenote(phase, notes) as (values " + ", ".join(
        "(%d,%s)" % (ph, q(PHNOTE[ph])) for ph in (1,2,3)) + "),")

    L.append("w as (")
    L.append("  insert into program_workouts (program_id, name, day_of_week, order_index, week_number,")
    L.append("                                notes, warmup_exercises, recovery_notes)")
    L.append("  select p.id, di.title, di.dow::int, di.ord::int, wk.week::int, pn.notes, di.warmup::jsonb,")
    L.append("         'Walk, sleep and eat enough protein between sessions - that is where the adaptation happens.'")
    L.append("  from p, dayinfo di cross join wk join phasenote pn on pn.phase = wk.phase")
    L.append("  returning id, day_of_week, week_number"); L.append("),")

    srows = []
    for d in p['days']:
        for ph, lst in d['ex'].items():
            for i, e in enumerate(lst):
                srows.append("(%d,%d,%d,%s,%d,%s,%s,%s,%d,%s,%s,%s)" % (
                    d['dow'], ph, i, q(e['name']), e['sets'], q(e['reps']), q(e['itype']),
                    q(e['ival']), e['rest'], q(e['restb']), q(e['wt']), q(e['note'])))
    L.append("spec(dow, phase, ord, exname, nsets, reps, itype, ival, rest, restb, wtype, exnote) as (values")
    L.append("  " + ",\n  ".join(srows) + "),")

    L.append("we as (")
    L.append("  insert into workout_exercises (workout_id, exercise_id, exercise_uuid, exercise_name,")
    L.append("                                 order_index, category, notes)")
    L.append("  select w.id, e.id::text, e.id, e.name, s.ord::int, 'strength', nullif(s.exnote,'')")
    L.append("  from w join wk on wk.week = w.week_number")
    L.append("         join spec s on s.dow = w.day_of_week and s.phase = wk.phase")
    L.append("         join exercises e on e.name = s.exname")
    L.append("  returning id, workout_id, order_index"); L.append(")")

    L.append("insert into exercise_sets (exercise_id, set_number, reps, intensity_type, intensity_value,")
    L.append("                           rest_seconds, rest_bracket, weight_type)")
    L.append("select we.id, gs.n, s.reps, s.itype, s.ival, s.rest::int, s.restb, s.wtype")
    L.append("from we join w on w.id = we.workout_id")
    L.append("        join wk on wk.week = w.week_number")
    L.append("        join spec s on s.dow = w.day_of_week and s.phase = wk.phase and s.ord = we.order_index")
    L.append("        cross join lateral generate_series(1, s.nsets::int) gs(n);")
    return "\n".join(L)

tot_w = tot_e = tot_s = 0
for p in PROGRAMS:
    sql = emit(p)
    open(SP + '/sql_' + p['slug'] + '.sql', 'w').write(sql)
    nd = len(p['days']); nw = nd * p['weeks']
    ne = sum(len(l) for d in p['days'] for l in d['ex'].values()) * p['weeks'] // 3
    ns = sum(e['sets'] for d in p['days'] for l in d['ex'].values() for e in l) * p['weeks'] // 3
    tot_w += nw; tot_e += ne; tot_s += ns
    print("%-12s %2dwk  %3d workouts  %4d exercises  %4d sets  %6d bytes" % (
        p['slug'], p['weeks'], nw, ne, ns, len(sql)))
print("TOTAL: %d workouts, %d exercises, %d sets" % (tot_w, tot_e, tot_s))
