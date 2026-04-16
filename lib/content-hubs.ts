// lib/content-hubs.ts — Content Hub definitions
// Each hub is a pillar page that aggregates related posts.

export interface HubFaq {
  q: string;
  a: string;
}

export interface ContentHub {
  slug: string;
  title: string;
  metaTitle: string;
  description: string;
  /** Keywords used to pull related posts from the DB (case-insensitive ILIKE match on title) */
  keywords: string[];
  /** 800+ word HTML pillar intro rendered in the page body */
  intro: string;
  faqs: HubFaq[];
  color: string;
}

export const CONTENT_HUBS: Record<string, ContentHub> = {

  // ─────────────────────────────────────────────────────────────────────────────
  'relationship-guide': {
    slug:        'relationship-guide',
    title:       'Complete Relationship Guide',
    metaTitle:   'Complete Relationship Guide: Build a Healthy, Lasting Partnership',
    description: 'Everything you need to build a healthy, fulfilling relationship — from communication and trust to conflict resolution and emotional intimacy.',
    keywords:    ['communication', 'trust', 'conflict', 'intimacy', 'boundaries', 'commitment', 'emotional', 'vulnerability', 'marriage', 'couple'],
    color:       '#e8447a',
    intro: `
<p>Every relationship is a living, breathing entity — shaped by two individuals who bring their histories, hopes, and vulnerabilities into shared space. Whether you are in your first serious relationship or rebuilding after years of disappointment, the fundamentals of a healthy partnership remain the same: mutual respect, honest communication, and the willingness to grow together.</p>

<h2>What Makes a Relationship Healthy?</h2>
<p>A healthy relationship is not one where conflict never happens. Conflict is inevitable when two people with different needs, backgrounds, and expectations share their lives. What distinguishes a thriving relationship from a struggling one is how partners navigate that conflict — whether they turn toward each other or away.</p>
<p>Research consistently points to the same core pillars: emotional safety, clear communication, and a balance of independence and togetherness. When both partners feel seen and heard — not just during the good moments, but especially during the hard ones — the relationship gains a resilience that can weather almost anything.</p>
<p>John Gottman's decades of research identified what he called the "Four Horsemen" — criticism, contempt, defensiveness, and stonewalling — as the primary predictors of relationship breakdown. Their antidotes — gentle start-up, appreciation, taking responsibility, and self-soothing — are not grand gestures. They are small, daily choices that compound over time into either closeness or distance.</p>

<h2>Communication: The Foundation of Connection</h2>
<p>Most relationship problems are not really about the issue on the surface — the dishes left unwashed, the missed birthday, the careless remark. They are about unmet needs and the inability to express them safely. Communication in a healthy relationship is not about winning arguments or saying exactly the right words. It is about creating a space where both people feel safe enough to be honest.</p>
<p>This means practicing active listening — not just waiting for your turn to speak, but genuinely trying to understand your partner's perspective. It means expressing your needs clearly using "I" statements rather than accusations. And it means knowing when to pause, when the emotional temperature is too high for productive conversation, and returning to the discussion when both people are regulated.</p>
<p>Couples who communicate well do not avoid difficult topics — they develop shared rituals for addressing them. They check in regularly, not just when something is wrong. They celebrate small moments and name what they appreciate about each other with the same energy they bring to addressing problems.</p>

<h2>Trust: Built Slowly, Broken Quickly</h2>
<p>Trust is the invisible architecture of every relationship. It is built through thousands of small, consistent moments — following through on promises, being where you said you would be, responding with care when your partner is vulnerable. And it can be damaged not just by dramatic betrayals, but by accumulated small moments of dismissiveness, criticism, or emotional unavailability.</p>
<p>Rebuilding trust after it has been broken is among the most challenging work a couple can do together. It requires the person who caused harm to take full responsibility without defensiveness, to be radically transparent, and to understand that rebuilding trust is a process — not a destination reached by a single apology.</p>
<p>For the person who was hurt, rebuilding trust means allowing themselves to be open to change while also honoring their need for safety. It is a delicate balance, and many couples benefit greatly from professional support during this process.</p>

<h2>Emotional Intimacy: Beyond Physical Connection</h2>
<p>Physical attraction may bring people together, but emotional intimacy is what keeps them there. Emotional intimacy is the feeling of being truly known — sharing your fears, dreams, and vulnerabilities with someone who receives them with care rather than judgment.</p>
<p>Many couples, especially after years together, find that their emotional connection has dulled. The early intensity fades, and routine takes over. Maintaining emotional intimacy requires intentionality: regular deep conversations, the willingness to stay curious about who your partner is becoming (people change), and creating shared experiences that go beyond the logistics of daily life.</p>
<p>Vulnerability is the engine of emotional intimacy. Brene Brown's research shows that allowing yourself to be seen — even imperfectly — is not a weakness. It is the act through which closeness is actually created. When partners can say "I am scared" or "I need reassurance" without fear of ridicule or dismissal, the relationship becomes a genuine refuge.</p>

<h2>Boundaries: The Framework for Respect</h2>
<p>Healthy boundaries are often misunderstood. They are not walls to keep people out — they are clearly communicated expectations about how you need to be treated. Boundaries in a relationship might include how you handle conflict, how much time each person needs alone, what topics feel off-limits without mutual agreement to explore them, or how you interact with extended family.</p>
<p>The key is that boundaries must be communicated clearly and respected consistently. A relationship where one person's limits are repeatedly ignored — whether intentionally or through carelessness — is one where resentment will accumulate over time. Conversely, when boundaries are honored, both partners feel safe enough to be genuinely open with each other.</p>

<h2>Navigating Conflict Constructively</h2>
<p>The goal of conflict in a healthy relationship is not to win — it is to understand. Couples who navigate conflict well have learned to separate the problem from the person, to listen for the unmet need beneath the complaint, and to repair after rupture quickly and sincerely.</p>
<p>Repair attempts — small gestures of reconnection during or after a disagreement — are one of the strongest predictors of relationship longevity. A touch on the arm, a moment of humor, an admission of your own role in the problem: these signals communicate that the relationship matters more than the argument, and they allow both people to return to collaboration rather than remaining in opposition.</p>

<h2>When to Seek Professional Help</h2>
<p>One of the most common misconceptions about couples therapy is that it is only for relationships in crisis. In reality, the couples who benefit most from professional support are often those who seek it before they reach a breaking point — who recognize that a skilled third party can help them communicate more effectively and break patterns that have become entrenched.</p>
<p>If you find yourselves having the same argument over and over, if physical or emotional distance has become the norm, or if one or both of you feels fundamentally unseen by the other, these are signals worth taking seriously. Seeking support is not a sign that the relationship has failed — it is a sign that you are committed enough to invest in it.</p>

<h2>Building a Relationship That Lasts</h2>
<p>Long-term relationships are not sustained by love alone — love is a feeling that fluctuates. What sustains a relationship over decades is commitment: the daily choice to show up, to repair after rupture, and to keep choosing each other even when it is hard. It is the habit of small kindnesses, the practice of gratitude, and the willingness to keep growing — both individually and together.</p>
<p>The articles in this guide explore every dimension of that journey. Wherever you are in your relationship, you will find practical, honest resources here to help you move forward with more clarity, compassion, and connection.</p>
`,
    faqs: [
      {
        q: 'What makes a relationship healthy?',
        a: 'A healthy relationship is built on mutual respect, honest communication, and emotional safety. Partners feel secure enough to be vulnerable, address conflict constructively rather than destructively, and support each other\'s individual growth while maintaining a genuine shared connection.',
      },
      {
        q: 'How do you rebuild trust after a betrayal?',
        a: 'Rebuilding trust requires the person who caused harm to take full responsibility without defensiveness, be radically transparent going forward, and understand that trust is rebuilt through consistent actions over time — not a single apology. The injured partner needs space to grieve and may need professional support to process the breach safely.',
      },
      {
        q: 'How can couples improve communication?',
        a: 'Effective couple communication starts with active listening — genuinely trying to understand your partner\'s experience before responding. Use "I" statements to express needs rather than criticisms, choose the right moment for difficult conversations (not when either person is flooded), and develop repair rituals for reconnecting after conflict.',
      },
      {
        q: 'What are the signs that a relationship needs professional help?',
        a: 'Signs include having the same unresolved argument repeatedly, growing emotional or physical distance, feeling chronically unseen or unheard, contempt or stonewalling during conflict, and loss of affection or interest in the relationship. Seeking couples therapy early — before crisis — produces the best outcomes.',
      },
      {
        q: 'How important are boundaries in a relationship?',
        a: 'Boundaries are essential — they are the framework within which genuine intimacy can exist. Without clearly communicated and consistently respected limits, resentment accumulates and safety erodes. Healthy boundaries are not about control; they are about creating conditions where both people feel respected and can be genuinely open.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  'dating-guide': {
    slug:        'dating-guide',
    title:       'Dating Guide',
    metaTitle:   'Dating Guide: From First Date to Real Connection',
    description: 'Navigate modern dating with clarity — from reading compatibility signals and surviving first dates to making the leap toward commitment.',
    keywords:    ['dating', 'first date', 'compatibility', 'attraction', 'single', 'chemistry', 'compatible', 'flirt', 'match', 'courtship'],
    color:       '#1a73e8',
    intro: `
<p>Dating in the modern world comes with more options — and more confusion — than any previous generation has faced. Swipe-based apps have created the paradox of choice, where the abundance of potential partners can make genuine connection feel harder to find. Meanwhile, the social scripts that once guided courtship have largely dissolved, leaving many people uncertain about everything from how quickly to respond to a message to what commitment even means in the current landscape.</p>

<h2>What Dating Is Really For</h2>
<p>The purpose of dating is not to audition potential partners against a checklist — it is to discover genuine compatibility through experience. This distinction matters more than it might seem. When we approach dating as a selection process, we tend to either accept someone before we really know them or reject them for failing to meet criteria that may not actually matter for long-term happiness. When we approach it as a process of discovery, we become curious rather than evaluative, which creates the conditions for real connection to emerge.</p>
<p>Real compatibility is not about shared interests in the conventional sense — it is about shared values, compatible conflict styles, similar visions of how life should be lived, and the capacity to grow together. These things take time to assess. They cannot be determined from a profile or even a first date.</p>

<h2>The First Date: Setting the Right Foundation</h2>
<p>First dates carry enormous expectation, which is part of why they can feel so fraught. The anxiety of wanting to make a good impression often causes people to perform a curated version of themselves rather than simply being present. This is understandable, but it creates a paradox: the more you perform, the harder it is for genuine connection to form.</p>
<p>The most successful first dates happen when both people are curious about each other rather than trying to impress. This means asking questions that matter — not interview-style interrogations, but genuine inquiries into how a person thinks, what they care about, and how they relate to the world. It means listening with real attention rather than waiting to respond. And it means being honest about yourself — including your uncertainties — rather than projecting a flawless image.</p>
<p>Location and activity matter too. High-stakes first dates (expensive dinners, elaborate plans) create pressure and formality. Low-stakes meetings — a walk, a casual coffee — create space for authentic conversation and reduce the anxiety that comes from high investment before real knowledge.</p>

<h2>Reading Compatibility Signals</h2>
<p>Attraction and compatibility are related but distinct. Physical attraction is relatively immediate; genuine compatibility requires time to observe. Some signs of real compatibility include: feeling comfortable being yourself around the person, conversations that flow naturally and go in interesting directions, a shared sense of humor, and the absence of red flags that you find yourself rationalizing.</p>
<p>Red flags are worth taking seriously without catastrophizing. A red flag is not simply a preference mismatch — it is behavior that suggests someone is not operating with integrity, empathy, or respect. Dismissiveness, habitual lateness without acknowledgment, speaking poorly of everyone they have ever dated, and reluctance to be seen in public together are patterns that warrant careful attention, not explanation.</p>

<h2>Pacing: The Art of Not Rushing</h2>
<p>One of the most common mistakes in dating is accelerating intimacy before genuine trust and compatibility have been established. This can happen emotionally (sharing extremely personal information very early) or physically (moving faster than feels genuinely natural for both people). Both can create a false sense of closeness that collapses when real life intervenes.</p>
<p>Pacing is not about playing games or withholding yourself strategically. It is about allowing the relationship to develop organically, through accumulated shared experiences and a growing sense of who this person actually is — not just who they appear to be in the charged context of early dating.</p>
<p>A useful heuristic: ask yourself whether you are moving fast because it feels genuinely right, or because you are afraid the other person will lose interest if you slow down. The latter is a signal worth pausing on.</p>

<h2>Navigating Modern Dating Apps</h2>
<p>Apps and online dating have fundamentally changed the courtship landscape. They have made it possible to meet people outside your immediate social circle — genuinely valuable, particularly for those in smaller communities or niche social groups. But they have also created a culture of disposability, where it is easy to swipe on to the next option rather than investing in getting to know someone imperfect but genuine.</p>
<p>The antidote is intentionality. Knowing what you are actually looking for, being honest about it early, and being willing to invest time in connections that have real potential — rather than cycling through dozens of mediocre first dates — tends to produce much better outcomes than treating dating as a numbers game.</p>

<h2>Dating After Heartbreak</h2>
<p>Returning to dating after a painful relationship ends is emotionally complex. There is the risk of bringing unresolved wounds into new connections — of projecting past hurt onto people who do not deserve it, or of recreating familiar patterns because they feel comfortable even when they are harmful.</p>
<p>Taking time to genuinely process a previous relationship — ideally with professional support — before jumping back into dating is not avoidance. It is due diligence. The most common outcomes of dating too soon after heartbreak are either numbing (using new dates as distraction) or recreating the same relational dynamics with a different person.</p>

<h2>From Dating to Commitment</h2>
<p>There is no universal timeline for when a dating relationship becomes a committed partnership. What matters is that both people have had honest conversations about what they want, that their visions are genuinely compatible, and that the decision to commit is made with clear eyes — not under the pressure of momentum or fear of loss.</p>
<p>The resources collected in this guide offer practical, grounded support for every stage of that process — from the first message to the first real conversation about the future.</p>
`,
    faqs: [
      {
        q: 'What should you talk about on a first date?',
        a: 'Focus on topics that reveal how a person thinks and what they value: their passions, what they find meaningful in work or life, how they spend their time, and what they are looking for. Avoid interrogating about serious topics too early (marriage, children, salary) — let the conversation develop naturally toward depth.',
      },
      {
        q: 'How do you know if you are compatible with someone?',
        a: 'Compatibility becomes visible over time through shared values (not just interests), how you handle disagreements, whether you feel comfortable being yourself around them, whether they bring out curiosity or anxiety in you, and whether your visions of life — including lifestyle, family, and growth — are genuinely aligned.',
      },
      {
        q: 'How long should you date before committing?',
        a: 'There is no fixed timeline. What matters is that both people have seen each other in a variety of situations (stressed, bored, in conflict, meeting family), have had honest conversations about expectations, and feel genuinely chosen rather than settled for. Rushing commitment out of fear of losing someone often produces the same instability the anxiety was trying to prevent.',
      },
      {
        q: 'What are the biggest red flags when dating someone new?',
        a: 'Key red flags include: consistent dismissiveness toward your feelings, speaking about all past partners only in negative terms, dishonesty about small things, pushing physical or emotional boundaries you have expressed, reluctance to make plans or integrate you into their life, and love-bombing (intense, disproportionate affection very early) followed by withdrawal.',
      },
      {
        q: 'How do you start dating again after a long relationship?',
        a: 'Give yourself time to genuinely grieve and learn from the previous relationship before re-entering the dating landscape. Reflect on what patterns played out, what you need differently, and what you are actually ready for. Starting with low-pressure social situations — rather than immediately engaging dating apps — can ease the transition more naturally.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  'self-growth-guide': {
    slug:        'self-growth-guide',
    title:       'Self-Growth & Healing Guide',
    metaTitle:   'Self-Growth & Healing Guide: Become Whole Before You Love',
    description: 'A guide to healing past wounds, building self-trust, and developing the emotional maturity that makes lasting love possible.',
    keywords:    ['healing', 'trauma', 'anxiety', 'confidence', 'mindset', 'overthinking', 'self-esteem', 'inner', 'growth', 'worthiness'],
    color:       '#1e8e3e',
    intro: `
<p>The relationship you have with yourself sets the template for every relationship you will have with others. This is not a self-help cliche — it is a psychological reality with deep empirical support. The way you speak to yourself in moments of failure, the degree to which you trust your own instincts, the patterns you have absorbed from early experiences of love and care: all of these shape the way you show up in partnership, whether you are aware of it or not.</p>

<h2>Why Self-Work Is Relational Work</h2>
<p>Many people pursue self-growth in isolation from their relational lives, treating personal development as something separate from how they love. But the two are inseparable. Unexamined wounds do not disappear when a new relationship begins — they resurface, often in the exact moments that feel most inexplicable. The unexplained rage over a small slight, the wall that goes up when someone gets too close, the urge to withdraw when things get difficult: these responses are rarely about the present moment. They are echoes of older experiences that were never fully processed.</p>
<p>Self-growth in service of better relationships does not mean becoming perfect before you can love. It means developing enough self-awareness to catch your patterns in real time, enough self-compassion to not be destroyed by them, and enough courage to communicate honestly about them with the people who matter to you.</p>

<h2>Understanding Your Relational Patterns</h2>
<p>We all have relational patterns — habitual ways of relating to others that were adaptive at some earlier point in our lives and may no longer serve us. The person who shuts down emotionally when conflict arises probably learned, at some point, that expressing emotion was not safe. The person who becomes anxious and clingy in relationships may have experienced early caregiving that was inconsistent or unpredictable. These patterns made sense then. They create problems now.</p>
<p>Identifying your patterns is the first step toward changing them. This requires honest self-observation: noticing what triggers disproportionate emotional responses, what kinds of situations reliably make you want to flee or fight, what needs tend to go chronically unmet in your relationships. Therapy — particularly modalities like EMDR, IFS, or somatic work — can accelerate this process enormously.</p>

<h2>Healing from Trauma</h2>
<p>Trauma is broader than we commonly understand it. Big-T Trauma — abuse, neglect, loss, violence — is well recognized. But small-t trauma — the accumulated weight of chronic emotional dismissal, growing up with a depressed or emotionally absent parent, being consistently misunderstood by caregivers — shapes the nervous system just as surely, if less dramatically.</p>
<p>Healing from trauma is not about erasing the past — it is about changing your relationship to it. When trauma is processed, the memories do not disappear, but they lose their charge. They become stories you have lived through rather than wounds that keep reopening. This shift is what makes genuine intimacy possible: when you are no longer defending against old pain, you have the capacity to be present with someone new.</p>
<p>The body keeps score, as Bessel van der Kolk writes. Trauma is stored somatically — in the tension patterns, the hypervigilance, the freeze responses that emerge in moments of perceived threat. Effective trauma work addresses not just the narrative of what happened, but the physiological residue it has left behind.</p>

<h2>Building Self-Trust</h2>
<p>Self-trust is built through small, consistent moments of keeping promises to yourself: following through when you say you will do something, honoring your own limits, making decisions that align with your values rather than what is convenient or what will please others. For people who grew up in environments where their perceptions were invalidated — where they were told that what they felt was not real, or that their responses were wrong — self-trust can feel profoundly elusive.</p>
<p>Rebuilding self-trust starts with small, consistent acts of self-honoring. It means taking your own discomfort seriously rather than dismissing it. It means making decisions from your own center rather than by tracking other people's approval. And it means tolerating the discomfort of disappointing others in service of your own integrity — something that initially feels terrifying but gradually builds the inner stability that healthy relationships require.</p>

<h2>Setting Boundaries as an Act of Self-Respect</h2>
<p>For many people, setting limits feels selfish — as if having needs is an imposition on others. This belief is almost always a learned one, absorbed from environments where needs were met with dismissal, guilt, or punishment. But clear limits are not about keeping people out. They are about creating the conditions under which genuine closeness is possible. You can only be truly open with someone when you trust that your limits will be respected.</p>
<p>Learning to communicate your needs is a skill that develops with practice. It begins with identifying your actual limits — not the ones you think you should have, but the ones you genuinely feel. It continues with expressing them clearly and consistently, and with tolerating the discomfort of responses that may initially be negative.</p>

<h2>The Inner Child and Adult Love</h2>
<p>Much of what we bring to our adult relationships is a child's attempt to get needs met that were never fully addressed. Inner child work — whether in a formal therapeutic context or through more personal reflection — involves developing a compassionate relationship with the younger version of yourself who still lives within. This is not regression; it is integration. When you can parent your inner child rather than having them drive your adult relationships, you gain access to a level of emotional maturity that transforms the way you love.</p>

<h2>Growth as an Ongoing Practice</h2>
<p>Self-growth is not a destination — it is a practice. There is no finish line, no point at which you are fully healed and ready to love perfectly. What there is, instead, is increasing skill: at recognizing your patterns, at returning to yourself more quickly when you lose the thread, at communicating with more honesty and less defensiveness. Each relationship becomes an opportunity to practice, to learn, and to grow into a more complete version of yourself.</p>
<p>The resources in this guide offer practical, grounded support for that journey — whether you are just beginning to explore these ideas or deepening a long-standing practice of self-development.</p>
`,
    faqs: [
      {
        q: 'How does childhood trauma affect adult relationships?',
        a: 'Childhood trauma shapes the nervous system\'s baseline expectations of safety and closeness. Adults with unprocessed trauma may find themselves reacting to their partner as though they were an earlier threatening figure, struggling to tolerate intimacy, chronically anticipating abandonment, or feeling emotionally numb. These patterns are not character flaws — they are survival adaptations that can be addressed through trauma-informed therapy.',
      },
      {
        q: 'How long does healing from a painful relationship take?',
        a: 'There is no universal timeline. Research suggests that processing a significant loss or heartbreak typically takes about half the duration of the relationship, but this varies enormously based on how invested you were, whether trauma was involved, and the support you have. The more important question is not "how long" but "am I actually processing, or am I just waiting for the feeling to pass?"',
      },
      {
        q: 'What does it mean to love yourself before loving someone else?',
        a: 'It means having a stable enough relationship with yourself — your worth, your needs, your emotional responses — that you are not seeking a partner to fill a void or provide something you cannot provide for yourself. It does not mean achieving perfection or having no unresolved issues. It means being able to self-soothe, self-direct, and offer something to another person rather than primarily needing to receive.',
      },
      {
        q: 'How do you break negative patterns in relationships?',
        a: 'Identifying the pattern is the essential first step — noticing what triggers it, what need it is trying to meet, and where it originated. From there, the work involves building awareness in real time (catching yourself before automatically reacting), developing alternative responses, and creating enough safety in your current relationship to try something different. This process is significantly accelerated through therapy.',
      },
      {
        q: 'What is inner child work and how does it help relationships?',
        a: 'Inner child work involves recognizing and compassionately relating to the younger version of yourself — the one who formed core beliefs about love, safety, and worthiness based on early experiences. When that younger self drives adult behavior (through fear of abandonment, difficulty with intimacy, or emotional reactivity), it creates relational problems that are difficult to resolve at the surface level. Addressing the root helps break the cycle.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  'attachment-guide': {
    slug:        'attachment-guide',
    title:       'Attachment & Psychology Guide',
    metaTitle:   'Attachment Style Guide: Understanding Your Love Blueprint',
    description: 'Learn how your attachment style shapes the way you love — and how to build the self-awareness to form more secure, fulfilling connections.',
    keywords:    ['attachment', 'psychology', 'avoidant', 'anxious', 'secure', 'patterns', 'nervous system', 'fearful', 'disorganized'],
    color:       '#9334e6',
    intro: `
<p>The way you love — and the way love either feels safe or terrifying — was shaped long before you had words for it. Attachment theory, first developed by John Bowlby and later expanded by researchers like Mary Ainsworth, offers one of the most powerful frameworks for understanding why we behave the way we do in intimate relationships. Understanding your attachment style is not about labeling yourself — it is about gaining the self-knowledge needed to interrupt patterns that no longer serve you.</p>

<h2>What Is Attachment Theory?</h2>
<p>Attachment theory begins with a simple premise: as children, we are wired to seek proximity to our caregivers when we feel threatened or afraid. The responses we received — consistent and warm, inconsistent and unpredictable, emotionally absent, or frightening — taught our nervous systems what to expect from close relationships. These expectations, encoded deep in our biology and shaped through repeated experience, become our attachment style: an internal working model of love that we carry into every significant relationship in our lives.</p>
<p>Ainsworth's original research identified three main patterns in children: secure, anxious-ambivalent, and avoidant. Later research by Mary Main and Judith Solomon added a fourth: disorganized, sometimes called fearful-avoidant. These patterns persist into adulthood, shaping how we relate to romantic partners in ways that often feel automatic and outside conscious control — until we make them conscious.</p>

<h2>The Four Attachment Styles</h2>
<p><strong>Secure attachment</strong> develops when early caregivers were consistently responsive — not perfect, but reliably present and emotionally available. Securely attached adults generally feel comfortable with intimacy, can communicate their needs directly, and recover from conflict relatively quickly. They trust that love does not require them to either cling or flee.</p>
<p><strong>Anxious attachment</strong> (also called preoccupied) develops when early care was inconsistent — warm sometimes and unavailable others — creating a nervous system trained to be hypervigilant to signs of rejection or abandonment. Anxiously attached adults often seek high levels of closeness and reassurance, worry about their partner's feelings and intentions, and may become activated (anxious, clingy, or reactive) when they perceive distance.</p>
<p><strong>Avoidant attachment</strong> (also called dismissive) develops when emotional needs were consistently met with dismissal, withdrawal, or discomfort. Avoidantly attached adults learned to suppress their attachment needs as a survival strategy. They often feel more comfortable with independence than intimacy, may withdraw when things get emotionally intense, and can mistake emotional distance for strength or self-sufficiency.</p>
<p><strong>Disorganized attachment</strong> (fearful-avoidant) develops in contexts where the caregiver was also a source of fear — through abuse, severe neglect, or their own unresolved trauma. People with this pattern simultaneously want closeness and are terrified by it. Their behavior in relationships can feel chaotic, to themselves and their partners, as the pull toward connection and the fear of it operate simultaneously.</p>

<h2>How Attachment Styles Interact</h2>
<p>One of the most significant findings in attachment research is the dynamic between anxious and avoidant partners — sometimes called the "anxious-avoidant trap." The anxious partner's pursuit of closeness activates the avoidant partner's withdrawal, which intensifies the anxious partner's pursuit, which triggers more withdrawal. Both people are doing exactly what their nervous systems learned to do. The dynamic creates a cycle of escalating distress for both.</p>
<p>Understanding this dynamic does not immediately break it, but it changes the meaning of the behavior. The avoidant partner is not withdrawing because they do not care — they are doing so because closeness feels overwhelming to a nervous system that learned that emotional needs were burdensome. The anxious partner is not being irrational or needy — they are responding to cues of potential abandonment with a nervous system trained to treat separation as dangerous.</p>
<p>This reframe — from character flaw to nervous system response — opens space for compassion and for behavioral change, rather than escalating blame.</p>

<h2>Can Attachment Styles Change?</h2>
<p>Yes — attachment styles are not fixed traits. They are patterns that developed in a specific relational context and can shift through sustained corrective relational experiences. A relationship with a securely attached partner — or a strong therapeutic relationship — can, over time, help rewire the nervous system's expectations of what closeness is allowed to feel like.</p>
<p>This is one of the most hopeful findings in the attachment literature: "earned security" — developing a secure attachment style through positive relational experiences in adulthood — is not only possible but well documented. It requires both intellectual understanding of the origin of your patterns and enough repeated corrective experiences to shift what your nervous system registers as safe.</p>

<h2>Attachment and Conflict</h2>
<p>Conflict is where attachment styles become most visible. Under stress, we regress to our earliest relational strategies. The anxious partner may escalate — raising their voice, issuing ultimatums, becoming increasingly activated in an attempt to elicit a response. The avoidant partner may shut down, leave the room, or go silent for hours. Neither strategy resolves the underlying issue; both deepen the disconnection.</p>
<p>Couples who understand their attachment dynamics can learn to interrupt these cycles by naming them in real time: "I notice I am getting activated" or "I can feel myself wanting to withdraw — I need fifteen minutes and then I want to come back to this." This kind of metacommunication — talking about the process rather than only its content — is one of the most powerful tools available to couples doing attachment work.</p>

<h2>Working with Your Attachment Style</h2>
<p>Knowing your style is the beginning, not the end. The practical work involves: developing a pause between trigger and response; learning to self-soothe so that you can stay regulated enough to communicate clearly; building explicit agreements with your partner about how you will each signal distress and what kind of support you each need; and consistently returning to repair after rupture, rather than staying in disconnection.</p>
<p>The posts in this guide explore attachment theory from multiple angles — the basics of each style, the dynamics between different style combinations, and the practical tools for moving toward greater security, whether you are working alone or with a partner.</p>
`,
    faqs: [
      {
        q: 'What are the four attachment styles?',
        a: 'Secure (comfortable with intimacy and interdependence), Anxious/Preoccupied (hypervigilant to rejection, seeks high closeness and reassurance), Avoidant/Dismissive (suppresses attachment needs, values independence highly), and Disorganized/Fearful-Avoidant (simultaneously desires and fears intimacy, often rooted in early experiences with frightening caregivers).',
      },
      {
        q: 'Can you change your attachment style?',
        a: 'Yes. Attachment styles are not permanent traits — they are patterns that developed in specific relational contexts and can shift through corrective relational experiences. This typically happens through a secure, consistent therapeutic relationship, a reliably secure romantic partnership, or both. The process requires both insight and repeated lived experience of feeling safe in close relationships.',
      },
      {
        q: 'What does anxious attachment look like in relationships?',
        a: 'Anxious attachment often looks like: frequent reassurance-seeking, reading into small changes in partner behavior, difficulty tolerating space or silence in the relationship, fear of abandonment that activates even in stable relationships, and a tendency to either cling or protest (escalate conflict) when feeling distant from a partner.',
      },
      {
        q: 'How do avoidant and anxious partners interact?',
        a: 'They typically create what researchers call the "anxious-avoidant trap": the anxious partner\'s pursuit of closeness triggers the avoidant partner\'s withdrawal, which intensifies the anxious partner\'s pursuit. Both are following their nervous system\'s learned strategy. Breaking the cycle requires both people to understand their own pattern and develop the capacity to self-regulate and communicate needs rather than enacting them.',
      },
      {
        q: 'How does disorganized attachment affect relationships?',
        a: 'Disorganized attachment (fearful-avoidant) creates a fundamental internal conflict: the person simultaneously craves closeness and is frightened by it. This can produce seemingly contradictory behavior — pushing a partner away and then desperately trying to reconnect, difficulty sustaining intimacy over time, and intense reactivity to perceived threat in the relationship. It typically responds best to trauma-informed therapy.',
      },
    ],
  },

};

export function getHub(slug: string): ContentHub | null {
  return CONTENT_HUBS[slug] ?? null;
}
