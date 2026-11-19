CREATE TABLE offers (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    application_id  BIGINT        NOT NULL UNIQUE REFERENCES applications (id) ON DELETE CASCADE,
    offered_ctc_lpa NUMERIC(6, 2) NOT NULL CHECK (offered_ctc_lpa >= 0),
    joining_date    DATE,
    offer_status    VARCHAR(16)   NOT NULL DEFAULT 'PENDING',
    notes           VARCHAR(500),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT ck_offers_status CHECK (offer_status IN ('PENDING', 'ACCEPTED', 'DECLINED'))
);

CREATE INDEX ix_offers_status ON offers (offer_status);