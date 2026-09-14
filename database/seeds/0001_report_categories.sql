insert into public.report_categories (
    code,
    name,
    description
)
values
    (
        'infrastructure',
        'Infrastruktur',
        'Laporan terkait jalan, drainase, jembatan, dan infrastruktur lainnya.'
    ),
    (
        'public_facility',
        'Fasilitas Publik',
        'Laporan terkait fasilitas umum dan pelayanan masyarakat.'
    ),
    (
        'cleanliness',
        'Kebersihan dan Lingkungan',
        'Laporan terkait sampah, kebersihan, dan kondisi lingkungan.'
    ),
    (
        'security',
        'Keamanan',
        'Laporan terkait gangguan keamanan atau keselamatan.'
    ),
    (
        'social',
        'Sosial',
        'Laporan terkait kondisi sosial masyarakat.'
    ),
    (
        'administration',
        'Administrasi',
        'Laporan terkait pelayanan administratif.'
    ),
    (
        'other',
        'Lainnya',
        'Laporan yang belum termasuk kategori lain.'
    )
on conflict (code) do nothing;
