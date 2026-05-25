type Params = {
    params: Promise<{
        groupId: string;
    }>;
};

export default async function GroupDetailPage(props: Params) {
    const params = await props.params;

    return (
        <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 p-8">
            <div className="max-w-4xl w-full mx-auto">
                <h1 className="text-2xl font-bold tracking-tight mb-4">Grupo: {params.groupId}</h1>
                <p className="text-zinc-500 dark:text-zinc-400">
                    Detalles del grupo.
                </p>
            </div>
        </div>
    );
}
