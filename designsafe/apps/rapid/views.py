from django.core.urlresolvers import reverse
from django.http import HttpResponse, JsonResponse, HttpResponseRedirect
from django.shortcuts import render
from requests import HTTPError
from django.contrib.auth.decorators import login_required
import json
import logging
from designsafe.apps.rapid.models import RapidNHEventType, RapidNHEvent
from designsafe.apps.rapid import forms as rapid_forms

logger = logging.getLogger(__name__)

@login_required
def index(request):
    return render(request, 'designsafe/apps/rapid/index.html')

def get_event_types(request):
    s = RapidNHEventType.search()
    results  = s.execute()
    out = [h.to_dict() for h in results.hits]
    return JsonResponse(out, safe=False)

def get_events(request):
    s = RapidNHEvent.search()
    results = s.execute()
    out = [h.to_dict() for h in results.hits]
    return JsonResponse(out, safe=False)


@login_required
def admin(request):
    return render(request, 'designsafe/apps/rapid/admin.html')

@login_required
def admin_create_event(request):
    if request.method == 'POST':
        form = rapid_forms.RapidNHEventForm(request.POST)
        if form.is_valid():
            logger.info(form.cleaned_data)
            ev = RapidNHEvent(**form.cleaned_data)
            ev.bullshit = "HELLO"
            logger.info(ev)
            ev.save()
            return HttpResponseRedirect(reverse('designsafe_rapid:admin'))
        else:
            context = {}
            context["form"] = form
            return render(request, 'designsafe/apps/rapid/admin_create_event.html', context)
    else:
        form = rapid_forms.RapidNHEventForm();
        context = {}
        context["form"] = form
        return render(request, 'designsafe/apps/rapid/admin_create_event.html', context)
