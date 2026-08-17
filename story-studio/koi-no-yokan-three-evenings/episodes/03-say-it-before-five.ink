// Koi no Yokan: Three Evenings
// Episode 3: Say It Before Five
// Requires the series variables listed in UPLOAD_CHECKLIST.md.

@PRIMARY_CHARACTER: id=Mizuki
@SCENE_UPDATE: background="La Dolce Vita", transition=fade, duration=1.2, music="Cherry Promenade", musicFade=1
@CHARACTER_UPDATE: id=Mizuki, side=left
@CHARACTER_UPDATE: id=Kaito, side=right

La Dolce Vita is all warm light and small tables. There is nowhere for a silence to hide.

Kaito places a coffee in front of Mizuki before she orders.

Kaito (happy): I remember everything except when to mind my own business.

Mizuki (normal): You wrote the letters.

Kaito (normal): I did.

Mizuki (angry): You knew about the residency?

Kaito (shocked): The what?

His surprise is too immediate to be charming.

Kaito (normal): I knew you stopped making plans after Friday.

Kaito (sad): I knew you were giving things back that nobody asked for.

Kaito (normal): We did not know the secret. We only knew you were saying goodbye without words.

@HIDE_CHARACTER: id=Kaito
@CHARACTER_UPDATE: id=Sora, side=right

Sora (sad): You returned my sports bottle.

Mizuki (normal): It was yours.

Sora (happy): It was also an excuse to come running with me.

@HIDE_CHARACTER: id=Sora
@CHARACTER_UPDATE: id=Kaede, side=right

Kaede (normal): You cancelled two races.

Kaede (happy): Nobody quits while I still have a stopwatch.

@HIDE_CHARACTER: id=Kaede
@CHARACTER_UPDATE: id=Ren, side=right

Ren (normal): You left the telescope on my steps.

Ren (happy): The sky did not need it back.

Mizuki (sad): You all noticed.

Ren (normal): We noticed you.

@HIDE_CHARACTER: id=Ren
@CHARACTER_UPDATE: id=Kaito, side=right

Kaito puts the original three-evening note on the table.

Kaito (normal): The plan was only to get you into three rooms with people who would stay.

Kaito (happy): What you say in the third room is still yours.

Mizuki looks at the clock. Four forty-seven.

Mizuki (normal): Then I should stop making everyone wait.

@HIDE_CHARACTER: id=Kaito

Mizuki places the keepsake from the beach on the table.

{ keepsake == "sketchbook": -> show_sketchbook }
{ keepsake == "mixtape": -> show_mixtape }
-> show_tickets

=== show_sketchbook ===

She opens the sketchbook to an unfinished portrait. The face is complete. The space beside it is still blank.

Mizuki (normal): I kept drawing a future and leaving room for someone without asking if they wanted to stand there.

-> confession_router

=== show_mixtape ===

She sets down the mixtape. Every song marks a night she thought she would remember alone.

Mizuki (normal): I made a record of this summer before it was over.

Mizuki (sad): I think that was easier than admitting I wanted another one.

-> confession_router

=== show_tickets ===

She sets down two blank train tickets. No destination has been written on either one.

Mizuki (normal): I bought these before I knew where I was going.

Mizuki (happy): I knew I did not want every future trip to be alone.

-> confession_router

=== confession_router ===

{ route == "rin": -> confess_rin }
{ route == "haruto": -> confess_haruto }
-> confess_reina

=== confess_rin ===
@CHARACTER_UPDATE: id=Rin, side=right

Rin sits across from her, arms crossed tightly enough to count as armor.

{ honesty >= 2:
    Rin (normal): I know about the residency. I still need the answer.
- else:
    Rin (normal): Finish the sentence, Mizuki.
}

Mizuki (normal): I was accepted to a three-month artist residency. The answer is due at five.

Rin (sad): And you thought choosing me meant choosing against it.

Mizuki (sad): I thought wanting both made me selfish.

Rin (angry): Wanting both makes you inconvenient.

Rin (happy): I can work with inconvenient.

Mizuki (normal): Then here is what I want.

-> future_choice

=== confess_haruto ===
@CHARACTER_UPDATE: id=Haruto, side=right

Haruto sits across from her, patient without pretending the clock is not moving.

{ honesty >= 2:
    Haruto (normal): I know the offer. I do not know your choice.
- else:
    Haruto (normal): You have thirteen minutes to stop editing the first sentence.
}

Mizuki (normal): I was accepted to a three-month artist residency. The answer is due at five.

Haruto (normal): Do you want me to tell you to stay?

Mizuki (sad): Part of me does.

Haruto (happy): I will not make your fear sound like my devotion.

Haruto (normal): Tell me what you want. Then let me answer honestly too.

Mizuki (normal): Then here is what I want.

-> future_choice

=== confess_reina ===
@CHARACTER_UPDATE: id=Reina, side=right

Reina sits across from her. For once, there is no stage light between them.

{ honesty >= 2:
    Reina (normal): I know about the residency. I came for the unrehearsed part.
- else:
    Reina (normal): No metaphors now. Give me the line as written.
}

Mizuki (normal): I was accepted to a three-month artist residency. The answer is due at five.

Reina (sad): And you were afraid desire would make you cruel.

Mizuki (sad): Yes.

Reina (normal): Desire only becomes cruel when you make someone else guess it.

Reina (happy): So do not make me guess.

Mizuki (normal): Then here is what I want.

-> future_choice

=== future_choice ===

* [Accept the residency and ask to stay connected]
    ~ future = "residency"
    ~ courage = courage + 1
    -> future_residency
* [Accept and invite them to opening weekend]
    ~ future = "opening"
    ~ courage = courage + 2
    -> future_opening
* [Stay and build the next project here]
    ~ future = "home"
    ~ honesty = honesty + 1
    -> future_home

=== future_residency ===

Mizuki (normal): I am accepting the residency.

Mizuki (sad): I do not know exactly what three months will do to us.

Mizuki (normal): I want to find out together, instead of protecting you with silence.

{ route == "rin": -> rin_residency }
{ route == "haruto": -> haruto_residency }
-> reina_residency

=== future_opening ===

Mizuki (normal): I am accepting the residency.

Mizuki (happy): The opening is in six weeks. Come with me.

{ keepsake == "tickets":
    She writes the city on the two blank tickets.
}

{ route == "rin": -> rin_opening }
{ route == "haruto": -> haruto_opening }
-> reina_opening

=== future_home ===

Mizuki (normal): I am staying.

Mizuki (normal): Not because leaving scares me. I know what I want to make here, with this city, next.

Mizuki (happy): I am choosing it on purpose.

{ route == "rin": -> rin_home }
{ route == "haruto": -> haruto_home }
-> reina_home

=== rin_residency ===
Rin (normal): I will not promise to enjoy the time difference.

Rin (happy): I will promise to answer.

Rin reaches across the table and takes Mizuki's hand as if annoyed that it was so far away.

Rin (angry): Never vanish politely again.

Mizuki (happy): I will be inconvenient instead.

Rin (happy): Good.

-> final_image

=== rin_opening ===
Rin (shocked): You are asking me to travel for an art opening?

Mizuki (happy): I am asking you to stand in the blank part of the picture.

Rin (angry): That was almost unbearably romantic.

Rin takes the second ticket.

Rin (happy): Yes.

-> final_image

=== rin_home ===
Rin (normal): Are you staying because you want this, or because leaving became difficult?

Mizuki (normal): Because I want this.

Rin (happy): Then I believe you.

Rin takes her hand under the table.

Rin (angry): You still owe me a trip.

Mizuki (happy): Two tickets. No disappearing.

-> final_image

=== haruto_residency ===
Haruto (normal): Three months is specific. Specific is useful.

He opens the sketchbook and writes three dates on the blank page: first call, first visit, first day home.

Haruto (happy): We can revise the plan. We do not erase it.

Mizuki (happy): That sounds dangerously like optimism.

Haruto (happy): Do not tell anyone.

-> final_image

=== haruto_opening ===
Haruto (happy): You finally asked a direct question.

Mizuki (normal): Is that a yes?

Haruto takes the second ticket and writes his name beneath hers.

Haruto (happy): That is a direct answer.

-> final_image

=== haruto_home ===
Haruto (normal): Tell me the project.

Mizuki describes a series of three city evenings, painted from memory before the light can change.

Haruto (happy): That does not sound like fear.

Haruto writes the first exhibition date into her sketchbook.

Haruto (normal): It sounds like work. I can believe in work.

-> final_image

=== reina_residency ===
Reina (normal): Call me after every night you think nobody understands the work.

Mizuki (happy): That could be every night.

Reina (happy): Then I will learn your new time zone.

The music ends. Reina leans across the small table and kisses her without waiting for an audience.

-> final_image

=== reina_opening ===
Reina (happy): Opening weekend deserves a proper last set.

Mizuki (shocked): You would perform?

Reina (normal): I would arrive.

Reina takes the second ticket.

Reina (happy): The performance is extra.

-> final_image

=== reina_home ===
Reina (normal): Staying can be brave. It can also be camouflage.

Mizuki (normal): This is not camouflage.

Mizuki describes the new city series until five o'clock passes unnoticed.

Reina (happy): Good. Then paint it.

The music ends. Reina kisses her in the sudden quiet.

-> final_image

=== final_image ===

The clock reaches five.

Mizuki sends her answer.

Outside, the city is still there. So is everyone she finally asked to stay in the picture.

@HAPTIC: id="success"
@MUSIC_STOP: fade=2
-> END
