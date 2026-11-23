-- Family names fit one line of a phone's header: at most 40 characters.
-- not valid: existing longer names stay as they are; new and renamed ones are checked.
alter table public.families
  add constraint families_name_max_length check (char_length(name) <= 40) not valid;
