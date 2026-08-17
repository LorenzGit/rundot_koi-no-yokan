// Koi no Yokan: Three Evenings
// Episode 2: What the Tide Kept
// Requires the series variables listed in UPLOAD_CHECKLIST.md.

@PRIMARY_CHARACTER: id=Mizuki
@SCENE_UPDATE: background="Beach Terrace", transition=fade, duration=1.2, music="Cherry Promenade", musicFade=1
@CHARACTER_UPDATE: id=Mizuki, side=left
@CHARACTER_UPDATE: id=Sora, side=right

Beach Terrace is too bright for secrets. Even the water seems to throw every thought back at the sky.

Sora is waiting beside an empty chair, grinning as if the evening has already become a competition.

Sora (happy): You made it.

Mizuki (normal): You sound surprised.

Sora (happy): Kaede bet you would be four minutes late.

Mizuki (shocked): How late am I?

Sora (happy): Three minutes, fifty seconds.

@HIDE_CHARACTER: id=Sora
@CHARACTER_UPDATE: id=Kaede, side=right

Kaede jogs into view holding a small envelope above her head.

Kaede (happy): New personal best for emotional punctuality.

Mizuki (angry): Give me the letter.

Kaede (happy): First one to the end of the terrace gets it.

* [Race her without arguing]
    ~ courage = courage + 1
    Mizuki (happy): You are going to regret the head start.
    Kaede (shocked): That is the correct answer.
* [Distract her and grab the envelope]
    Mizuki (normal): Sora says your lace is loose.
    Kaede (shocked): What?
    Mizuki (happy): Also a correct answer.
* [Refuse to turn feelings into a sport]
    ~ honesty = honesty + 1
    Mizuki (normal): I came because I am trying to stop running from something.
    Kaede (normal): Fair.
    Kaede (happy): We can race after.

-
Kaede gives her the envelope. Inside is a single line.

Bring what you would save if the tide reached your door.

Mizuki reaches for her sketchbook.

It is gone.

@HIDE_CHARACTER: id=Kaede
@CHARACTER_UPDATE: id=Ren, side=right

Ren approaches from the far end of the terrace with the sketchbook tucked beneath one arm.

Ren (normal): This fell near the steps.

Mizuki (shocked): Did you open it?

Ren (normal): No.

Ren (happy): I know what a closed cover means.

Mizuki takes it. Nothing inside has shifted.

Ren (normal): Privacy is not the same thing as being alone.

Mizuki (sad): I am beginning to suspect everyone rehearsed a line for me.

Ren (happy): Mine was shorter in rehearsal.

@HIDE_CHARACTER: id=Ren

The person Mizuki chose last night arrives while the sunlight turns copper.

{ route == "rin": -> rin_beach }
{ route == "haruto": -> haruto_beach }
-> reina_beach

=== rin_beach ===
@CHARACTER_UPDATE: id=Rin, side=right

Rin arrives carrying two bubble teas and the expression of someone who has already blamed the wind.

Rin (angry): I was here on time. The drinks were late.

Mizuki (happy): Naturally.

Rin notices Mizuki gripping the recovered sketchbook.

Rin (normal): Is that what you would save?

Mizuki (normal): Maybe. I have to choose.

-> keepsake_choice

=== haruto_beach ===
@CHARACTER_UPDATE: id=Haruto, side=right

Haruto arrives without coffee this time. The absence feels intentional.

Haruto (normal): You look like the ocean gave something back.

Mizuki (normal): My sketchbook. Ren found it.

Haruto (happy): Then the evening is already ahead.

Haruto reads the new clue.

Haruto (normal): What would you save?

Mizuki (normal): I have to choose.

-> keepsake_choice

=== reina_beach ===
@CHARACTER_UPDATE: id=Reina, side=right

Reina arrives in sunglasses even though the sun is almost gone.

Reina (happy): The beach is very committed to making everyone look honest.

Mizuki (normal): Is it working?

Reina studies her, then the new clue.

Reina (normal): Not yet.

Reina (happy): What would you save?

Mizuki (normal): I have to choose.

-> keepsake_choice

=== keepsake_choice ===

Mizuki opens her bag. Three things feel heavier than they should.

* [The sketchbook, full of unfinished work]
    ~ keepsake = "sketchbook"
    Mizuki (normal): The sketchbook.
    Mizuki (sad): Not because the drawings are good. Because they are not finished.
* [The mixtape of songs from this summer]
    ~ keepsake = "mixtape"
    Mizuki (normal): The mixtape.
    Mizuki (happy): I would want proof that this summer sounded like something.
* [The two train tickets with no destination written]
    ~ keepsake = "tickets"
    ~ courage = courage + 1
    Mizuki (normal): The tickets.
    Mizuki (happy): I would rather save somewhere we have not gone yet.

-
The answer settles between them. The real one waits behind it.

* [Tell them about the residency]
    -> tell_everything
* [Admit there is a deadline, but not the choice]
    -> tell_deadline
* [Ask them to wait until tomorrow]
    -> ask_for_time

=== tell_everything ===
~ honesty = honesty + 2
~ courage = courage + 1

Mizuki (sad): I was offered an artist residency. Three months away. I have to answer tomorrow at five.

{ route == "rin": -> truth_rin }
{ route == "haruto": -> truth_haruto }
-> truth_reina

=== tell_deadline ===
~ honesty = honesty + 1

Mizuki (sad): There is a decision. It has a deadline tomorrow at five.

Mizuki (normal): I am not ready to say the rest.

{ route == "rin": -> partial_rin }
{ route == "haruto": -> partial_haruto }
-> partial_reina

=== ask_for_time ===

Mizuki (normal): I need one more evening before I can say it properly.

{ route == "rin": -> wait_rin }
{ route == "haruto": -> wait_haruto }
-> wait_reina

=== truth_rin ===
Rin (shocked): You were going to leave for three months and tell me when?

Mizuki (sad): I did not know how.

Rin (angry): That is not the same as not getting to.

Rin (normal): Go if you want it. Just do not turn me into a reason you invented alone.

-> beach_close_rin

=== partial_rin ===
Rin (angry): I hate half a sentence.

Rin (normal): But I hate stolen answers more.

Rin (sad): Tomorrow. No disappearing before then.

-> beach_close_rin

=== wait_rin ===
Rin (angry): I am only agreeing because you asked instead of vanishing.

Rin (normal): Tomorrow. All of it.

-> beach_close_rin

=== truth_haruto ===
Haruto (normal): Do you want the residency?

Mizuki (sad): I want it enough to be afraid of what it changes.

Haruto (happy): Good. That is a real answer.

Haruto (normal): Do not decide my part without asking me.

-> beach_close_haruto

=== partial_haruto ===
Haruto (normal): Then I will not solve it for you.

Haruto (happy): I will be at dinner when you are ready to finish the sentence.

-> beach_close_haruto

=== wait_haruto ===
Haruto (normal): Time is allowed.

Haruto (sad): Silence that pretends to be an answer is not.

Haruto (happy): Tomorrow.

-> beach_close_haruto

=== truth_reina ===
Reina (shocked): Three months.

Mizuki (normal): You sound surprised.

Reina (sad): I am surprised you thought distance would frighten me more than being excluded.

Reina (normal): Choose the work if you want it. Then choose what you ask of me.

-> beach_close_reina

=== partial_reina ===
Reina (normal): A deadline is not a confession.

Reina (happy): But it is the first honest line tonight.

Reina (normal): Finish it tomorrow.

-> beach_close_reina

=== wait_reina ===
Reina (normal): One evening.

Reina (happy): Do not rehearse so long that the truth loses its pulse.

-> beach_close_reina

=== beach_close_rin ===
Rin turns over the second envelope. Kaito's name and tomorrow's reservation are written on the back.

Rin (normal): La Dolce Vita. Warm light, small tables, nowhere to hide.

Rin (happy): Finally, a useful restaurant description.

-> beach_end

=== beach_close_haruto ===
Haruto turns over the second envelope. Kaito's name and tomorrow's reservation are written on the back.

Haruto (normal): La Dolce Vita. Warm light, small tables, nowhere to hide.

Haruto (happy): Whoever planned this knows you well.

-> beach_end

=== beach_close_reina ===
Reina turns over the second envelope. Kaito's name and tomorrow's reservation are written on the back.

Reina (normal): La Dolce Vita. Warm light, small tables, nowhere to hide.

Reina (happy): At last, a proper stage.

-> beach_end

=== beach_end ===

Mizuki places the chosen keepsake beside the letters.

Tomorrow, she will carry both to dinner.

This time, she will also carry an answer.

@MUSIC_STOP: fade=1.5
-> END
