// Koi no Yokan: Three Evenings
// Episode 1: The Page Left Blank
// Requires the series variables listed in UPLOAD_CHECKLIST.md.

@PRIMARY_CHARACTER: id=Mizuki
@SCENE_UPDATE: background="Sakura Plaza", transition=fade, duration=1.2, music="Cherry Promenade", musicFade=1
@CHARACTER_UPDATE: id=Mizuki, side=left

The acceptance letter has been folded and unfolded so often that its edges feel like cloth.

Mizuki (normal): Three months.

Mizuki (sad): One answer by five on Friday.

Petals skim the water below Sakura Plaza. The city is quiet enough to make every unfinished thought sound deliberate.

Mizuki opens her sketchbook. A second letter slips from between two blank pages.

The handwriting is unfamiliar.

Three evenings. Three places. One honest answer. Start where petals touch water.

Mizuki (shocked): I am already here.

Someone knows she is leaving.

Or someone knows she has been thinking about it.

Her phone feels heavier than the sketchbook.

* [Ask Rin to come]
    ~ route = "rin"
    ~ courage = courage + 1
    -> rin_arrives
* [Ask Haruto to come]
    ~ route = "haruto"
    ~ courage = courage + 1
    -> haruto_arrives
* [Ask Reina to come after her set]
    ~ route = "reina"
    ~ courage = courage + 1
    -> reina_arrives

=== rin_arrives ===
@CHARACTER_UPDATE: id=Rin, side=right

Rin arrives with her arms crossed and one untied ribbon.

Rin (angry): Your message said urgent. Then you added a flower emoji.

Rin (normal): Those two things should not be allowed together.

Mizuki (happy): You came fast.

Rin (angry): I was nearby.

She was not nearby.

Mizuki holds out the unsigned letter.

Rin (shocked): This is either romantic or extremely annoying.

Mizuki (normal): I cannot tell which scares me more.

* [Admit the note frightened you]
    ~ honesty = honesty + 1
    Mizuki (sad): I think someone noticed I was getting ready to disappear.
    Rin (sad): Then stop getting ready alone.
* [Make a joke about secret admirers]
    Mizuki (happy): Maybe the city finally noticed my mysterious appeal.
    Rin (angry): The city has poor judgment.
    Rin (happy): I might not.
* [Ask Rin to solve it with you]
    ~ courage = courage + 1
    Mizuki (normal): Will you come to the next place with me?
    Rin (shocked): You could have started with that.
    Rin (happy): Yes.

-
Rin turns the letter over. A pale blue line appears when it catches the plaza light.

Rin (normal): "Where the horizon refuses to sit still."

Mizuki (normal): Beach Terrace.

Rin (angry): Tomorrow. And this time you call before the crisis develops stationery.

-> first_promise

=== haruto_arrives ===
@CHARACTER_UPDATE: id=Haruto, side=right

Haruto arrives carrying two coffees and no visible curiosity.

Haruto (normal): You used a full stop in a text message.

Haruto (normal): I assumed the situation was serious.

Mizuki (happy): That is an alarming amount of attention.

Haruto offers her the warmer cup.

Mizuki hands him the unsigned letter.

Haruto (normal): Whoever wrote this knows you hate direct questions.

Mizuki (sad): Do I hate them?

Haruto (happy): You answer them with paintings.

* [Admit the note frightened you]
    ~ honesty = honesty + 1
    Mizuki (sad): I think someone noticed I was getting ready to disappear.
    Haruto (sad): Leaving is a place. Disappearing is a method.
* [Pretend it is only a puzzle]
    Mizuki (happy): It could be a very elaborate gallery invitation.
    Haruto (normal): Then the gallery knows exactly when you lie.
* [Ask Haruto to solve it with you]
    ~ courage = courage + 1
    Mizuki (normal): Will you come to the next place with me?
    Haruto (happy): I thought that was why you ordered the second coffee.

-
Haruto tilts the paper toward the plaza lights. A pale blue line appears on the back.

Haruto (normal): "Where the horizon refuses to sit still."

Mizuki (normal): Beach Terrace.

Haruto (happy): Tomorrow, then. Bring the truth if you find it before I do.

-> first_promise

=== reina_arrives ===
@CHARACTER_UPDATE: id=Reina, side=right

Reina arrives after rehearsal in the red dress she wears for her last set.

Reina (happy): You asked me to meet under falling petals. I expected better lighting.

Mizuki (happy): You brought your own.

Reina takes the unsigned letter between two careful fingers.

Reina (normal): This is staged.

Mizuki (shocked): You can tell?

Reina (happy): Everything is staged. The question is whether the feeling underneath it is real.

* [Admit the note frightened you]
    ~ honesty = honesty + 1
    Mizuki (sad): I think someone noticed I was getting ready to disappear.
    Reina (sad): Then they have been watching you leave before you moved.
* [Call it an overdramatic invitation]
    Mizuki (happy): Whoever wrote it has been listening to too many torch songs.
    Reina (angry): There is no such thing.
* [Ask Reina to solve it with you]
    ~ courage = courage + 1
    Mizuki (normal): Will you come to the next place with me?
    Reina (happy): Ask me like you mean it.
    Mizuki (normal): Please come.
    Reina (happy): Better. Yes.

-
Reina turns the paper toward the moon. A pale blue line appears on the back.

Reina (normal): "Where the horizon refuses to sit still."

Mizuki (normal): Beach Terrace.

Reina (happy): Tomorrow. Before you can rehearse another excuse.

-> first_promise

=== first_promise ===

The letter goes back into Mizuki's sketchbook, beside the acceptance she still cannot answer.

Mizuki (normal): I do not know what happens on the third evening.

{ route == "rin":
    Rin (normal): Neither does the third evening.
    Rin (happy): We have an advantage.
}
{ route == "haruto":
    Haruto (normal): Good.
    Haruto (happy): Predictions make people lazy.
}
{ route == "reina":
    Reina (normal): Neither does the audience.
    Reina (happy): That is why they stay.
}

Mizuki looks across the black water and makes one promise she can keep tonight.

Mizuki (normal): I will not disappear before tomorrow.

~ courage = courage + 1

@MUSIC_STOP: fade=1.5
-> END
