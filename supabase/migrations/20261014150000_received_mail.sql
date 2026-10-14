-- Time requests now get their own mail ("received"), so the client knows it arrived.
-- Every starting text is listed; existing rows keep whatever Bjorn wrote in Settings.
insert into mail_templates (key, lang, subject, body) values
  ('thanks', 'nl', 'Je afspraak bij Bjorn’s Barber staat vast', 'Hoi {{name}},

Bedankt voor je boeking. Je afspraak staat vast:

{{service}}
{{date}} om {{time}}
Ferdinandstraat 21, Axel

Lukt het toch niet? Stuur even een mail terug, dan zoeken we een ander moment.

Tot dan,
Bjorn'),
  ('thanks', 'en', 'Your appointment at Bjorn’s Barber is booked', 'Hi {{name}},

Thanks for booking. Your appointment is set:

{{service}}
{{date}} at {{time}}
Ferdinandstraat 21, Axel

Can''t make it after all? Just reply to this mail and we''ll find another time.

See you then,
Bjorn'),
  ('received', 'nl', 'We hebben je aanvraag ontvangen', 'Hoi {{name}},

Bedankt voor je aanvraag. Je vroeg om:

{{service}}
{{date}} om {{time}}

Bjorn kijkt of dat past en je krijgt zo snel mogelijk een mail of het doorgaat.

Groet,
Bjorn'),
  ('received', 'en', 'We received your request', 'Hi {{name}},

Thanks for your request. You asked for:

{{service}}
{{date}} at {{time}}

Bjorn will check whether that works and you''ll get a mail as soon as possible.

Best,
Bjorn'),
  ('accepted', 'nl', 'Je afspraak bij Bjorn’s Barber is bevestigd', 'Hoi {{name}},

Goed nieuws: je gevraagde tijd past. Je afspraak staat vast:

{{service}}
{{date}} om {{time}}
Ferdinandstraat 21, Axel

Tot dan,
Bjorn'),
  ('accepted', 'en', 'Your appointment at Bjorn’s Barber is confirmed', 'Hi {{name}},

Good news: the time you asked for works. Your appointment is set:

{{service}}
{{date}} at {{time}}
Ferdinandstraat 21, Axel

See you then,
Bjorn'),
  ('declined', 'nl', 'Dat tijdstip lukt helaas niet', 'Hoi {{name}},

{{date}} om {{time}} lukt helaas niet. Kies een vrije tijd op de site, of stuur een mail terug, dan zoeken we samen een ander moment.

Groet,
Bjorn'),
  ('declined', 'en', 'That time doesn''t work, sorry', 'Hi {{name}},

{{date}} at {{time}} doesn''t work, sorry. Pick a free time on the site, or reply to this mail and we''ll find another moment together.

Best,
Bjorn'),
  ('moved', 'nl', 'Je afspraak bij Bjorn’s Barber is verplaatst', 'Hoi {{name}},

Je afspraak is verplaatst naar een nieuw moment:

{{service}}
{{date}} om {{time}}
Ferdinandstraat 21, Axel

Past dit niet? Stuur even een mail terug, dan zoeken we een ander moment.

Tot dan,
Bjorn'),
  ('moved', 'en', 'Your appointment at Bjorn’s Barber has moved', 'Hi {{name}},

Your appointment has moved to a new time:

{{service}}
{{date}} at {{time}}
Ferdinandstraat 21, Axel

Doesn''t this work for you? Just reply to this mail and we''ll find another time.

See you then,
Bjorn')
on conflict (key, lang) do nothing;
